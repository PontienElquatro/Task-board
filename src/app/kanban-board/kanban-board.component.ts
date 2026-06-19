import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskService, Task, Status } from '../services/task.service';
import { TaskColumnComponent } from '../task-column/task-column.component';
import { TaskModalComponent } from '../task-modal/task-modal.component';

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [CommonModule, TaskColumnComponent, TaskModalComponent],
  templateUrl: './kanban-board.component.html',
})
export class KanbanBoardComponent {
  private taskService = inject(TaskService);

  columns: { label: string; status: Status }[] = [
    { label: 'à faire', status: 'todo' },
    { label: 'en cours', status: 'in-progress' },
    { label: 'terminé', status: 'done' },
  ];

  selectedTask: Task | null = null;
  modalMode: 'view' | 'edit' | 'delete' = 'view';

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
    this.taskService.updateTask(task);
    this.closeModal();
  }

  deleteConfirmed() {
    if (this.selectedTask) {
      this.taskService.deleteTask(this.selectedTask.id);
      this.closeModal();
    }
  }
}
