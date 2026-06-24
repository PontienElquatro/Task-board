import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { STORAGE_PROVIDER } from '../providers/storage.provider';
import { Task, Status, Priority } from '../models';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private readonly STORAGE_KEY = 'mytaskboard_tasks';
  private storage = inject(STORAGE_PROVIDER);

  private tasksSignal = signal<Task[]>(this.loadTasks());
  readonly tasks = this.tasksSignal.asReadonly();

  // Search and Filters
  searchTerm = signal<string>('');
  filterStatus = signal<Status | 'all'>('all');
  filterPriority = signal<Priority | 'all'>('all');

  filteredTasks = computed(() => {
    let tasks = this.tasksSignal();
    const search = this.searchTerm().toLowerCase();
    const status = this.filterStatus();
    const priority = this.filterPriority();

    if (search) {
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(search) ||
        t.description.toLowerCase().includes(search)
      );
    }

    if (status !== 'all') {
      tasks = tasks.filter(t => t.status === status);
    }

    if (priority !== 'all') {
      tasks = tasks.filter(t => t.priority === priority);
    }

    return tasks;
  });

  constructor() {
    effect(() => {
      this.storage.setItem(this.STORAGE_KEY, this.tasksSignal());
    });
  }

  private loadTasks(): Task[] {
    const saved = this.storage.getItem<Task[]>(this.STORAGE_KEY);
    if (saved) {
      return saved.map(t => ({
        ...t,
        createdAt: new Date(t.createdAt),
        startDate: t.startDate ? new Date(t.startDate) : undefined,
        dueDate: t.dueDate ? new Date(t.dueDate) : undefined,
      }));
    }

    return [
      {
        id: '1',
        title: 'Créer la tâche',
        description: 'À débuter',
        status: 'todo',
        priority: 'medium',
        subTasks: [],
        createdAt: new Date(),
        userId: 'default'
      },
      {
        id: '2',
        title: 'Continuer à y travailler',
        description: 'Cette tâche est encore en cours',
        status: 'in-progress',
        priority: 'high',
        subTasks: [],
        createdAt: new Date(),
        userId: 'default'
      },
      {
        id: '3',
        title: 'Tâche terminée',
        description: 'Cette tâche est terminée',
        status: 'done',
        priority: 'low',
        subTasks: [],
        createdAt: new Date(),
        userId: 'default'
      },
    ];
  }

  addTask(task: Omit<Task, 'id' | 'createdAt' | 'userId'>) {
    const newTask: Task = {
      ...task,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      userId: 'default', // To be updated with real user
      priority: task.priority || 'medium',
      subTasks: task.subTasks || []
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
    return computed(() => this.filteredTasks().filter(t => t.status === status));
  }

  updateTaskStatus(taskId: string, status: Status) {
    this.tasksSignal.update(tasks =>
      tasks.map(t => t.id === taskId ? { ...t, status } : t)
    );
  }
}
