import { Task } from './index';

export function dayKey(value: Date): string {
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
}
export function isOverdue(task: Task, today = new Date()): boolean {
  return task.status !== 'done' && !!task.dueDate && dayKey(task.dueDate) < dayKey(today);
}
export function normalizeTasks(value: unknown): Task[] {
  if (!Array.isArray(value) || value.length > 10000) throw new Error('Maximum 10 000 tâches par sauvegarde.');
  const ids = new Set<string>();
  return value.map((t: any, index) => {
    if (!t || typeof t.id !== 'string' || !t.id || ids.has(t.id)) throw new Error('Identifiant manquant ou dupliqué.');
    ids.add(t.id);
    if (typeof t.title !== 'string' || !t.title.trim() || t.title.length > 200) throw new Error('Titre invalide (1 à 200 caractères).');
    if (!['todo', 'in-progress', 'done'].includes(t.status)) throw new Error('Statut invalide.');
    const date = (raw: unknown): Date | undefined => {
      if (raw == null || raw === '') return undefined;
      if (!(typeof raw === 'string' || raw instanceof Date)) throw new Error('Date invalide.');
      const result = new Date(raw);
      if (!Number.isFinite(result.getTime())) throw new Error('Date invalide.');
      return result;
    };
    if (t.subTasks !== undefined && !Array.isArray(t.subTasks)) throw new Error('Sous-tâches invalides.');
    if (t.tags !== undefined && (!Array.isArray(t.tags) || !t.tags.every((tag: unknown) => typeof tag === 'string'))) throw new Error('Tags invalides.');
    return {
      id: t.id, title: t.title.trim(), description: typeof t.description === 'string' ? t.description.slice(0, 10000) : '',
      status: t.status, priority: ['low', 'medium', 'high'].includes(t.priority) ? t.priority : 'medium',
      createdAt: date(t.createdAt) ?? new Date(), dueDate: date(t.dueDate), startDate: date(t.startDate),
      userId: typeof t.userId === 'string' ? t.userId : 'default',
      goalId: typeof t.goalId === 'string' ? t.goalId : undefined,
      projectId: typeof t.projectId === 'string' ? t.projectId : undefined,
      order: Number.isFinite(t.order) ? t.order : index, archived: t.archived === true,
      tags: [...new Set<string>((t.tags ?? []).map((tag: string) => tag.trim().slice(0, 30)).filter(Boolean))].slice(0, 10),
      subTasks: (t.subTasks ?? []).map((sub: any) => {
        if (!sub || typeof sub.id !== 'string' || typeof sub.title !== 'string' || !sub.title.trim()) throw new Error('Sous-tâche invalide.');
        return { id: sub.id, title: sub.title.trim().slice(0, 200), completed: sub.completed === true };
      })
    };
  });
}
export function moveTask(tasks: Task[], id: string, status: Task['status'], index: number): Task[] {
  const moved = tasks.find(t => t.id === id);
  if (!moved || moved.archived) return tasks;
  const column = tasks.filter(t => t.id !== id && t.status === status && !t.archived).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  column.splice(Math.max(0, Math.min(index, column.length)), 0, { ...moved, status });
  return [...tasks.filter(t => t.id !== id && (t.status !== status || t.archived)), ...column.map((t, order) => ({ ...t, order }))];
}
