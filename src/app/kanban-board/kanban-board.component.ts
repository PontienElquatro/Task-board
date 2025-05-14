import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskCardComponent } from '../task-card/task-card.component';

type Status = 'todo' | 'in-progress' | 'done';

interface Column {
  label: string;
  status: Status;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: Status;
}

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [CommonModule, TaskCardComponent, FormsModule],
  templateUrl: './kanban-board.component.html',
})
export class KanbanBoardComponent {
  columns: Column[] = [
    { label: 'à faire', status: 'todo' },
    { label: 'en cours', status: 'in-progress' },
    { label: 'terminé', status: 'done' },
  ];

  tasks: Task[] = [
    { id: '1', title: 'Créer la tâche', description: 'À débuter', status: 'todo' },
    { id: '2', title: 'Continuer à y travailler', description: 'Cette tâche est encore en cours', status: 'in-progress' },
    { id: '3', title: 'Tâche terminée', description: 'Cette tâche est terminée', status: 'done' },
  ];

  selectedTask: Task | null = null;
  taskToEdit: Task | null = null;
  taskToDelete: Task | null = null;

  openTask(task: Task) {
    this.selectedTask = task;
  }

  closeModal() {
    this.selectedTask = null;
  }

  getTasksByStatus(status: Status): Task[] {
    return this.tasks.filter(task => task.status === status);
  }

  editTask(task: Task) {
    this.taskToEdit = { ...task };
  }

  updateTask(updatedTask: Task) {
    const index = this.tasks.findIndex(t => t.id === updatedTask.id);
    if (index > -1) {
      this.tasks[index] = updatedTask;
    }
    this.taskToEdit = null;
  }

  confirmDelete(task: Task) {
    this.taskToDelete = task;
  }

  cancelDelete() {
    this.taskToDelete = null;
  }

  deleteConfirmed() {
    if (this.taskToDelete) {
      this.tasks = this.tasks.filter(t => t.id !== this.taskToDelete?.id);
      this.taskToDelete = null;
    }
  }
}
