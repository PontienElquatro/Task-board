import { Injectable, signal, computed, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Status = 'todo' | 'in-progress' | 'done';
export type Priority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority?: Priority;
}

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private readonly STORAGE_KEY = 'mytaskboard_tasks';
  private platformId = inject(PLATFORM_ID);

  private tasksSignal = signal<Task[]>(this.loadTasks());

  readonly tasks = this.tasksSignal.asReadonly();

  constructor() {
    effect(() => {
      const tasks = this.tasksSignal();
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tasks));
      }
    });
  }

  private loadTasks(): Task[] {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Erreur lors du chargement des tâches depuis LocalStorage', e);
        }
      }
    }

    return [
      { id: '1', title: 'Créer la tâche', description: 'À débuter', status: 'todo', priority: 'medium' },
      { id: '2', title: 'Continuer à y travailler', description: 'Cette tâche est encore en cours', status: 'in-progress', priority: 'high' },
      { id: '3', title: 'Tâche terminée', description: 'Cette tâche est terminée', status: 'done', priority: 'low' },
    ];
  }

  addTask(task: Omit<Task, 'id'>) {
    const newTask = {
      ...task,
      id: Math.random().toString(36).substring(2, 9),
      priority: task.priority || 'medium'
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
