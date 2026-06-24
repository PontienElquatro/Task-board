import { Injectable, inject, computed } from '@angular/core';
import { TaskService } from './task.service';
import { GoalService } from './goal.service';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private taskService = inject(TaskService);
  private goalService = inject(GoalService);

  stats = computed(() => {
    const tasks = this.taskService.tasks();
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const todo = tasks.filter(t => t.status === 'todo').length;

    const now = new Date();
    const late = tasks.filter(t => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < now).length;

    const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      inProgress,
      todo,
      late,
      progressPercentage
    };
  });

  goalsProgress = computed(() => {
    const goals = this.goalService.goals();
    const tasks = this.taskService.tasks();

    return goals.map(goal => {
      const goalTasks = tasks.filter(t => t.goalId === goal.id);
      const total = goalTasks.length;
      const completed = goalTasks.filter(t => t.status === 'done').length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        ...goal,
        totalTasks: total,
        completedTasks: completed,
        progress
      };
    });
  });
}
