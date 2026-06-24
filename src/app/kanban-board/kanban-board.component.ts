import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskService } from '../services/task.service';
import { ThemeService } from '../services/theme.service';
import { Task, Status } from '../models';
import { TaskColumnComponent } from '../task-column/task-column.component';
import { TaskModalComponent } from '../task-modal/task-modal.component';
import { CdkDragDrop, moveItemInArray, transferArrayItem, DragDropModule } from '@angular/cdk/drag-drop';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [CommonModule, TaskColumnComponent, TaskModalComponent, DragDropModule, RouterLink],
  templateUrl: './kanban-board.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KanbanBoardComponent {
  public taskService = inject(TaskService);
  public themeService = inject(ThemeService);

  columns: { label: string; status: Status }[] = [
    { label: 'à faire', status: 'todo' },
    { label: 'en cours', status: 'in-progress' },
    { label: 'terminé', status: 'done' },
  ];

  selectedTask: Task | null = null;
  modalMode: 'view' | 'edit' | 'delete' | 'create' = 'view';

  // Signaux réactifs via le service
  todoTasks = this.taskService.getTasksByStatus('todo');
  inProgressTasks = this.taskService.getTasksByStatus('in-progress');
  doneTasks = this.taskService.getTasksByStatus('done');

  getTasksByStatus(status: Status) {
    switch (status) {
      case 'todo': return this.todoTasks();
      case 'in-progress': return this.inProgressTasks();
      case 'done': return this.doneTasks();
    }
  }

  addTask(status: Status = 'todo') {
    this.selectedTask = {
      id: '',
      title: '',
      description: '',
      status,
      priority: 'medium',
      subTasks: [],
      createdAt: new Date(),
      userId: 'default'
    };
    this.modalMode = 'create';
  }

  handleTaskSelected(task: Task) {
    this.selectedTask = task;
    this.modalMode = 'view';
  }

  handleTaskEdit(task: Task) {
    this.selectedTask = task;
    this.modalMode = 'edit';
  }

  handleTaskDelete(task: Task) {
    this.selectedTask = task;
    this.modalMode = 'delete';
  }

  closeModal() {
    this.selectedTask = null;
  }

  saveTask(task: Task) {
    if (this.modalMode === 'create') {
      this.taskService.addTask(task);
    } else {
      this.taskService.updateTask(task);
    }
    this.closeModal();
  }

  deleteConfirmed() {
    if (this.selectedTask) {
      this.taskService.deleteTask(this.selectedTask.id);
      this.closeModal();
    }
  }

  onTaskDropped(event: CdkDragDrop<Task[]>) {
    if (event.previousContainer === event.container) {
      // Pour l'instant on ne gère pas l'ordre précis via le service car il n'y a pas de champ position
      // Mais on pourrait implémenter moveItemInArray si nécessaire localement
    } else {
      const task = event.item.data as Task;
      const newStatus = event.container.id as Status;
      this.taskService.updateTaskStatus(task.id, newStatus);
    }
  }

  updateSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.taskService.searchTerm.set(value);
  }

  updateFilterStatus(event: Event) {
    const value = (event.target as HTMLSelectElement).value as Status | 'all';
    this.taskService.filterStatus.set(value);
  }

  updateFilterPriority(event: Event) {
    const value = (event.target as HTMLSelectElement).value as any; // Priority | 'all'
    this.taskService.filterPriority.set(value);
  }

  hasActiveFilters(): boolean {
    return this.taskService.searchTerm() !== '' ||
           this.taskService.filterStatus() !== 'all' ||
           this.taskService.filterPriority() !== 'all';
  }

  resetFilters() {
    this.taskService.searchTerm.set('');
    this.taskService.filterStatus.set('all');
    this.taskService.filterPriority.set('all');
  }

  trackByStatus(index: number, column: any) {
    return column.status;
  }
}
