import { Injectable, signal, computed } from '@angular/core';

export type Status = 'todo' | 'in-progress' | 'done';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: Status;
}

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private tasksSignal = signal<Task[]>([
    { id: '1', title: 'Créer la tâche', description: 'À débuter', status: 'todo' },
    { id: '2', title: 'Continuer à y travailler', description: 'Cette tâche est encore en cours', status: 'in-progress' },
    { id: '3', title: 'Tâche terminée', description: 'Cette tâche est terminée', status: 'done' },
  ]);

  readonly tasks = this.tasksSignal.asReadonly();

  addTask(task: Omit<Task, 'id'>) {
    const newTask = {
      ...task,
      id: Math.random().toString(36).substring(2, 9)
    };
    this.tasksSignal.update(tasks => [...tasks, newTask]);
  }

  updateTask(updatedTask: Task) {
    this.tasksSignal.update(tasks =>
      tasks.map(t => t.id === updatedTask.id ? updatedTask : t)
    );
  }

  deleteTask(id: string) {
    this.tasksSignal.update(tasks => tasks.filter(t => t.id !== id));
  }

  getTasksByStatus(status: Status) {
    return computed(() => this.tasksSignal().filter(t => t.status === status));
  }
}
