import { Component, inject, ChangeDetectionStrategy, ChangeDetectorRef, signal, computed, HostListener, afterNextRender, Injector } from '@angular/core';
import { GettingStartedComponent } from '../shared/getting-started.component';
import { IconComponent } from '../shared/icon.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../services/task.service';
import { ThemeService } from '../services/theme.service';
import { Task, Status } from '../models';
import { TaskColumnComponent } from '../task-column/task-column.component';
import { TaskModalComponent } from '../task-modal/task-modal.component';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isOverdue } from '../models/task-utils';
import { ProjectService } from '../services/project.service';
import { STORAGE_PROVIDER } from '../providers/storage.provider';
import { effect, untracked } from '@angular/core';
import { BrandComponent } from '../shared/brand/brand.component';
import { FilterBarComponent } from '../shared/filter-bar/filter-bar.component';
import { createTaskBackup, readTaskBackup } from '../core/storage/task-backup';
import { CloudStorageProvider } from '../providers/cloud-storage.provider';

@Component({
  selector: 'app-kanban-board', standalone: true,
  imports: [GettingStartedComponent,IconComponent, CommonModule, FormsModule, TaskColumnComponent, TaskModalComponent, DragDropModule, RouterLink, BrandComponent, FilterBarComponent],
  templateUrl: './kanban-board.component.html', styleUrl: './kanban-board.component.css', changeDetection: ChangeDetectionStrategy.OnPush
})
export class KanbanBoardComponent {
  activeProjectTitle(){return this.projectService.projects().find(p=>p.id===this.taskService.filterProject())?.title??'Mon tableau';}
  readonly cloud = inject(CloudStorageProvider);
  readonly taskService = inject(TaskService);
  readonly projectService = inject(ProjectService);
  private readonly storage = inject(STORAGE_PROVIDER);
  private readonly route = inject(ActivatedRoute);
  private readonly injector=inject(Injector);
  private readonly router=inject(Router);
  private readonly changeDetector=inject(ChangeDetectorRef);
  projectDraft=''; projectEditor=false; editingProjectId?:string;
  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params=>{
      this.openBoard(); this.taskService.filterProject.set(params.get('project') ?? '');
      if(params.get('create')==='task')afterNextRender(()=>{
        void this.router.navigate([],{relativeTo:this.route,queryParams:{create:null},queryParamsHandling:'merge',replaceUrl:true});
        this.addTask();
        this.changeDetector.markForCheck();
      },{injector:this.injector});
      this.changeDetector.markForCheck();
    });
    if(this.storage.contextVersion) effect(()=>{this.storage.contextVersion!(); untracked(()=>{
      this.closeModal(); this.projectEditor=false;
      this.taskService.filterProject.set(this.route.snapshot.queryParamMap.get('project') ?? '');
    });});
  }
  saveProject() { this.safely(()=>{const id=this.projectService.save(this.projectDraft,this.editingProjectId); this.openBoard(); this.taskService.filterProject.set(id); this.projectEditor=false; this.projectDraft=''; this.editingProjectId=undefined;}); }
  editProject(id:string) {this.editingProjectId=id; this.projectDraft=this.projectService.projects().find(p=>p.id===id)?.title ?? ''; this.projectEditor=true;}
  archiveProject(id:string) {this.safely(()=>this.projectService.archive(id));}
  readonly themeService = inject(ThemeService);
  readonly archiveOpen = signal(false);
  readonly importing = signal(false);
  readonly modalError = signal('');
  readonly columns: { label: string; status: Status }[] = [
    { label: 'À faire', status: 'todo' }, { label: 'En cours', status: 'in-progress' }, { label: 'Terminé', status: 'done' }
  ];
  selectedTask: Task | null = null;
  modalMode: 'view' | 'edit' | 'delete' | 'create' = 'view';
  readonly todoTasks = this.taskService.getTasksByStatus('todo');
  readonly inProgressTasks = this.taskService.getTasksByStatus('in-progress');
  readonly doneTasks = this.taskService.getTasksByStatus('done');
  readonly inProgressCount = computed(() => this.taskService.activeTasks().filter(t => t.status === 'in-progress').length);
  readonly completed = computed(() => this.taskService.activeTasks().filter(t => t.status === 'done').length);
  readonly late = computed(() => this.taskService.activeTasks().filter(t => isOverdue(t)).length);
  readonly progress = computed(() => Math.round(this.completed() / (this.taskService.activeTasks().length || 1) * 100));
  readonly hasActiveFilters = computed(() => !!this.taskService.searchTerm().trim() || this.taskService.filterStatus() !== 'all' ||
    this.taskService.filterPriority() !== 'all' || !!this.taskService.filterTag() || this.taskService.filterDue() !== 'all' || !!this.taskService.filterProject());
  readonly dragDisabled = computed(() => this.taskService.sort() !== 'manual');
  getTasksByStatus(status: Status) {
    return status === 'todo' ? this.todoTasks() : status === 'in-progress' ? this.inProgressTasks() : this.doneTasks();
  }
  addTask(status: Status = 'todo') {
    this.modalError.set('');
    this.selectedTask = { id: '', title: '', description: '', status, priority: 'medium', tags: [], subTasks: [], createdAt: new Date(), userId: 'default', projectId:this.taskService.filterProject() || undefined };
    this.modalMode = 'create';
  }
  handleTaskSelected(task: Task) { this.modalError.set(''); this.selectedTask = task; this.modalMode = 'view'; }
  handleTaskEdit(task: Task) { this.modalError.set(''); this.selectedTask = task; this.modalMode = 'edit'; }
  handleTaskDelete(task: Task) { this.modalError.set(''); this.selectedTask = task; this.modalMode = 'delete'; }
  closeModal() { this.selectedTask = null; }
  safely(action: () => void) {
    try { action(); } catch (error) { this.taskService.notice.set(error instanceof Error ? error.message : 'Action impossible.'); }
  }
  saveTask(task: Task) {
    this.modalError.set('');
    try {
      this.modalMode === 'create' ? this.taskService.addTask(task) : this.taskService.updateTask(task);
      if (this.hasActiveFilters()) this.resetFilters();
      this.archiveOpen.set(false);
      this.closeModal();
    } catch (error) {
      this.modalError.set(error instanceof Error ? error.message : 'Enregistrement impossible.');
    }
  }
  deleteConfirmed() {
    if (!this.selectedTask) return;
    try { this.taskService.deleteTask(this.selectedTask.id); this.closeModal(); }
    catch (error) { this.modalError.set(error instanceof Error ? error.message : 'Suppression impossible.'); }
  }
  archive(task: Task) { this.safely(() => this.taskService.archiveTask(task.id)); }
  restore(task: Task) { this.safely(() => this.taskService.restoreTask(task.id)); }
  duplicate(task: Task) { this.safely(() => this.taskService.duplicateTask(task)); }
  changeStatus(task: Task, status: Status) { this.safely(() => this.taskService.updateTaskStatus(task.id, status)); }
  toggleSubTask(subTaskId: string) {
    if (!this.selectedTask) return;
    try {
      const id = this.selectedTask.id;
      this.taskService.toggleSubTask(id, subTaskId);
      this.selectedTask = this.taskService.tasks().find(t => t.id === id) ?? null;
      this.modalError.set('');
    } catch (error) { this.modalError.set(error instanceof Error ? error.message : 'Modification impossible.'); }
  }
  openBoard(status: Status | 'all' = 'all') { this.resetFilters(); this.taskService.sort.set('manual'); this.taskService.filterStatus.set(status); this.archiveOpen.set(false); }
  examples() { this.safely(() => this.taskService.addExample()); }
  onTaskDropped(event: CdkDragDrop<Task[]>) {
    if (this.dragDisabled()) return;
    this.safely(() => {
      const id=event.item.data.id;
      const status=event.container.id as Status;
      const visible=this.getTasksByStatus(status).filter(t=>t.id!==id);
      const full=this.taskService.activeTasks().filter(t=>t.status===status && t.id!==id).sort((a,b)=>(a.order??0)-(b.order??0));
      const next=visible[event.currentIndex]; const previous=visible[event.currentIndex-1];
      const index=next?full.findIndex(t=>t.id===next.id):previous?full.findIndex(t=>t.id===previous.id)+1:full.length;
      this.taskService.reorderTask(id,status,index);
    });
  }
  resetFilters() {
    this.taskService.searchTerm.set(''); this.taskService.filterStatus.set('all');
    this.taskService.filterPriority.set('all'); this.taskService.filterTag.set(''); this.taskService.filterDue.set('all');
    this.taskService.filterProject.set('');
  }
  trackByStatus(_index: number, column: { status: Status }) { return column.status; }
  exportBackup() {
    this.safely(() => {
      const data = this.taskService.loadFailed() ? localStorage.getItem('mytaskboard_tasks') ?? '' :
        JSON.stringify(createTaskBackup(this.taskService.tasks()), null, 2);
      const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url;
      link.download = 'maat-' + new Date().toISOString().slice(0, 10) + '.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.taskService.notice.set('Sauvegarde téléchargée : tâches actives et archivées.');
    });
  }
  async importBackup(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.importing.set(true);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Le fichier dépasse 5 Mo.');
      const data = JSON.parse(await file.text());
      this.taskService.importTasks(readTaskBackup(data));
      if (data?.app === 'Maat' && data?.version === 1) {
        this.taskService.notice.set('Tâches de secours importées sans remplacer les tâches existantes. Les projets et objectifs ne sont pas restaurés par cet import.');
      }
    } catch (error) { this.taskService.notice.set(error instanceof Error ? error.message : 'Import impossible.'); }
    finally { input.value = ''; this.importing.set(false); }
  }
  @HostListener('document:keydown', ['$event'])
  shortcuts(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (this.selectedTask || event.ctrlKey || event.metaKey || event.altKey || target.closest('input,textarea,select,[contenteditable]')) return;
    if (event.key.toLowerCase() === 'n') { event.preventDefault(); this.addTask(); }
    if (event.key === '/') { event.preventDefault(); document.getElementById('task-search')?.focus(); }
  }
}
