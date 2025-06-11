import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskCardComponent } from '../task-card/task-card.component';
import { Objective } from '../models/objective.model';
import { Task } from '../models/task.model'; // ✅ On importe la vraie interface

type Status = 'todo' | 'in-progress' | 'done';

interface Column {
  label: string;
  status: Status;
}

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [CommonModule, TaskCardComponent, FormsModule],
  templateUrl: './kanban-board.component.html',
})
export class KanbanBoardComponent {
  objective: Objective = {
    id: 'obj-001',
    title: 'Construire une maison',
    description: 'Projet de construction',
    createdAt: new Date(),
    tasks: [
      {
        id: '1',
        title: 'Acheter un terrain',
        description: 'Rechercher un terrain disponible',
        status: 'todo',
        estimatedTime: 120,
        timeSpent: 0,
        subTasks: []
      },
      {
        id: '2',
        title: 'Faire les plans',
        description: 'Contacter un architecte',
        status: 'in-progress',
        estimatedTime: 60,
        timeSpent: 15,
        subTasks: []
      },
      {
        id: '3',
        title: 'Valider permis de construire',
        description: 'Déposer le dossier à la mairie',
        status: 'done',
        estimatedTime: 30,
        timeSpent: 30,
        subTasks: []
      }
    ]
  };

  columns: Column[] = [
    { label: 'à faire', status: 'todo' },
    { label: 'en cours', status: 'in-progress' },
    { label: 'terminé', status: 'done' },
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
    return this.objective.tasks.filter(task => task.status === status);
  }

  editTask(task: Task) {
    this.taskToEdit = { ...task };
  }

  updateTask(updatedTask: Task) {
    const index = this.objective.tasks.findIndex(t => t.id === updatedTask.id);
    if (index > -1) {
      this.objective.tasks[index] = updatedTask;
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
      this.objective.tasks = this.objective.tasks.filter(t => t.id !== this.taskToDelete?.id);
      this.taskToDelete = null;
    }
  }
}
