import { Injectable, inject, computed } from '@angular/core';
import { TaskService } from './task.service';
import { GoalService } from './goal.service';
import { isOverdue } from '../models/task-utils';
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private taskService = inject(TaskService);
  private goalService = inject(GoalService);
  stats = computed(() => {
    const tasks = this.taskService.activeTasks();
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'done').length;
    return { total, completed, todo: tasks.filter(t => t.status === 'todo').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      late: tasks.filter(t => isOverdue(t)).length, progressPercentage: Math.round(completed / (total || 1) * 100) };
  });
  distribution = computed(() => {
    const stats = this.stats();
    return [
      { label: 'À faire', count: stats.todo, color: 'var(--color-blue-500)' },
      { label: 'En cours', count: stats.inProgress, color: 'var(--color-yellow-500)' },
      { label: 'Terminé', count: stats.completed, color: 'var(--color-green-500)' }
    ].map(item => ({ ...item, percent: item.count / (stats.total || 1) * 100 }));
  });
  priorities = computed(() => {
    const tasks = this.taskService.activeTasks().filter(t => t.status !== 'done');
    return [
      { label: 'Haute', priority: 'high', color: 'var(--color-red-500)' },
      { label: 'Moyenne', priority: 'medium', color: 'var(--color-yellow-500)' },
      { label: 'Basse', priority: 'low', color: 'var(--color-gray-400)' }
    ].map(item => ({ ...item, count: tasks.filter(t => t.priority === item.priority).length }))
      .map(item => ({ ...item, percent: item.count / (tasks.length || 1) * 100, total: tasks.length }));
  });
  goalsProgress = computed(() => this.goalService.goals().map(goal => {
    const tasks = this.taskService.activeTasks().filter(t => t.goalId === goal.id);
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    return { ...goal, totalTasks: tasks.length, completedTasks, progress: Math.round(completedTasks / (tasks.length || 1) * 100) };
  }));
}
