import { Injectable, signal, computed, inject, effect, untracked } from '@angular/core';
import { STORAGE_PROVIDER } from '../providers/storage.provider';
import { Task, Status, Priority } from '../models';
import { normalizeTasks, moveTask, isOverdue } from '../models/task-utils';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly storage = inject(STORAGE_PROVIDER);
  private readonly key = 'mytaskboard_tasks';
  readonly notice = signal('');
  readonly loadFailed = signal(false);
  private readonly state = signal<Task[]>(this.load());
  readonly tasks = this.state.asReadonly();
  readonly activeTasks = computed(() => this.tasks().filter(t => !t.archived));
  readonly archivedTasks = computed(() => this.tasks().filter(t => t.archived));
  readonly tags = computed(() => [...new Set(this.activeTasks().flatMap(t => t.tags ?? []))].sort());
  readonly searchTerm = signal('');
  readonly filterStatus = signal<Status | 'all'>('all');
  readonly filterPriority = signal<Priority | 'all'>('all');
  readonly filterTag = signal('');
  readonly filterProject = signal('');
  readonly filterDue = signal<'all' | 'late' | 'none'>('all');
  readonly sort = signal<'manual' | 'priority' | 'due' | 'newest'>('manual');
  private readonly history = signal<Task[][]>([]);
  readonly canUndo = computed(() => this.history().length > 0);
  constructor() {
    if (this.storage.contextVersion) effect(() => {
      this.storage.contextVersion!();
      untracked(() => { this.loadFailed.set(false); this.state.set(this.load()); this.history.set([]); this.filterProject.set(''); });
    });
  }
  readonly filteredTasks = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase('fr');
    const ranks = { high: 0, medium: 1, low: 2 };
    return this.activeTasks().filter(t =>
      (!query || [t.title, t.description, ...(t.tags ?? []), ...t.subTasks.map(s => s.title)].join(' ').toLocaleLowerCase('fr').includes(query)) &&
      (this.filterStatus() === 'all' || t.status === this.filterStatus()) &&
      (this.filterPriority() === 'all' || t.priority === this.filterPriority()) &&
      (!this.filterTag() || t.tags?.includes(this.filterTag())) &&
      (!this.filterProject() || t.projectId === this.filterProject()) &&
      (this.filterDue() === 'all' || (this.filterDue() === 'late' ? isOverdue(t) : !t.dueDate))
    ).sort((a, b) => {
      switch (this.sort()) {
        case 'priority': return ranks[a.priority] - ranks[b.priority];
        case 'due': return (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity);
        case 'newest': return b.createdAt.getTime() - a.createdAt.getTime();
        default: return (a.order ?? 0) - (b.order ?? 0);
      }
    });
  });
  private load(): Task[] {
    try {
      const data = this.storage.getItem<unknown>(this.key);
      return data === null ? [] : normalizeTasks(data);
    } catch {
      this.loadFailed.set(true);
      this.notice.set('Données illisibles. Exportez la sauvegarde de secours ; les modifications sont bloquées pour protéger vos données.');
      return [];
    }
  }
  private commit(tasks: Task[], message: string) {
    if (this.loadFailed()) throw new Error('Données illisibles : exportez la sauvegarde de secours.');
    if (tasks.length > 10000) throw new Error('Votre tableau ne peut pas dépasser 10 000 tâches.');
    try {
      this.storage.setItem(this.key, tasks);
      this.history.update(h => [...h.slice(-19), this.state()]);
      this.state.set(tasks);
      this.notice.set(message);
    } catch {
      this.notice.set('Enregistrement impossible : stockage indisponible ou plein. Aucune modification appliquée.');
      throw new Error('Enregistrement impossible.');
    }
  }
  addTask(task: Omit<Task, 'id' | 'createdAt' | 'userId'>) {
    const added = normalizeTasks([{ ...task, id: crypto.randomUUID(), createdAt: new Date(), userId: 'default',
      archived: false, order: Math.max(-1, ...this.activeTasks().filter(t => t.status === task.status).map(t => t.order ?? 0)) + 1 }])[0];
    this.commit([...this.tasks(), added], 'Tâche créée.');
  }
  updateTask(task: Task) {
    const previous = this.tasks().find(t => t.id === task.id);
    if (!previous) throw new Error('Cette tâche n’existe plus.');
    const updated = normalizeTasks([task])[0];
    if (previous.status !== updated.status) updated.order = Math.max(-1, ...this.activeTasks().filter(t => t.status === updated.status).map(t => t.order ?? 0)) + 1;
    this.commit(this.tasks().map(t => t.id === task.id ? updated : t), 'Tâche enregistrée.');
  }
  toggleSubTask(taskId: string, subTaskId: string) {
    const task = this.tasks().find(t => t.id === taskId);
    if (!task || !task.subTasks.some(s => s.id === subTaskId)) throw new Error('Sous-tâche introuvable.');
    this.updateTask({ ...task, subTasks: task.subTasks.map(s => s.id === subTaskId ? { ...s, completed: !s.completed } : s) });
  }
  deleteTask(id: string) { this.commit(this.tasks().filter(t => t.id !== id), 'Tâche supprimée. Vous pouvez annuler.'); }
  archiveTask(id: string) { this.commit(this.tasks().map(t => t.id === id ? { ...t, archived: true } : t), 'Tâche archivée.'); }
  restoreTask(id: string) { this.commit(this.tasks().map(t => t.id === id ? { ...t, archived: false } : t), 'Tâche restaurée.'); }
  duplicateTask(task: Task) {
    this.addTask({ ...task, title: (task.title + ' — copie').slice(0, 200), subTasks: task.subTasks.map(s => ({ ...s, id: crypto.randomUUID() })) });
  }
  getTasksByStatus(status: Status) { return computed(() => this.filteredTasks().filter(t => t.status === status)); }
  reorderTask(id: string, status: Status, index: number) { this.commit(moveTask(this.tasks(), id, status, index), 'Position enregistrée.'); }
  updateTaskStatus(id: string, status: Status) { this.reorderTask(id, status, this.activeTasks().filter(t => t.status === status).length); }
  undo() {
    const previous = this.history().at(-1);
    if (!previous) return;
    try {
      this.storage.setItem(this.key, previous);
      this.state.set(previous); this.history.update(h => h.slice(0, -1)); this.notice.set('Action annulée.');
    } catch { this.notice.set('Impossible d’annuler : stockage indisponible.'); }
  }
  importTasks(data: unknown) {
    const tasks = normalizeTasks(data);
    const existing = new Set(this.tasks().map(t => t.id));
    const additions = tasks.filter(t => !existing.has(t.id));
    this.commit([...this.tasks(), ...additions], additions.length + ' tâche(s) importée(s). Les tâches existantes ont été conservées.');
  }

  addExample() {
    const examples: Task[] = [
      { title: 'Imaginer la prochaine étape', description: 'Rassembler les idées et choisir celles qui comptent vraiment.', status: 'todo', priority: 'medium', tags: ['Idées'], subTasks: [] },
      { title: 'Préparer la semaine', description: 'Un peu de recul pour une semaine plus sereine.', status: 'todo', priority: 'low', tags: ['Personnel'], subTasks: [] },
      { title: 'Donner vie à la première version', description: 'Transformer les idées en quelque chose de concret.', status: 'in-progress', priority: 'high', tags: ['Projet', 'Design'], subTasks: [{ id: crypto.randomUUID(), title: 'Définir les priorités', completed: true }, { id: crypto.randomUUID(), title: 'Tester le parcours', completed: false }] },
      { title: 'Recueillir les premiers retours', description: 'Partager, écouter et ajuster.', status: 'in-progress', priority: 'medium', tags: ['Projet'], subTasks: [] },
      { title: 'Poser les bases du projet', description: 'Une direction claire, une première étape franchie.', status: 'done', priority: 'low', tags: ['Projet'], subTasks: [] }
    ].map((t, order) => ({ ...t, id: crypto.randomUUID(), createdAt: new Date(), userId: 'default', order } as Task));
    this.commit([...this.tasks(), ...examples], 'Exemples ajoutés. Vous pouvez les modifier ou annuler.');
  }
}
