import { Injectable, signal, effect, inject } from '@angular/core';
import { STORAGE_PROVIDER } from '../providers/storage.provider';
import { Goal } from '../models';

@Injectable({
  providedIn: 'root'
})
export class GoalService {
  private readonly STORAGE_KEY = 'mytaskboard_goals';
  private storage = inject(STORAGE_PROVIDER);

  private goalsSignal = signal<Goal[]>(this.loadGoals());
  readonly goals = this.goalsSignal.asReadonly();

  constructor() {
    effect(() => {
      this.storage.setItem(this.STORAGE_KEY, this.goalsSignal());
    });
  }

  private loadGoals(): Goal[] {
    return this.storage.getItem<Goal[]>(this.STORAGE_KEY) || [];
  }

  addGoal(goal: Omit<Goal, 'id'>) {
    const newGoal: Goal = {
      ...goal,
      id: crypto.randomUUID()
    };
    this.goalsSignal.update(goals => [...goals, newGoal]);
  }

  updateGoal(updatedGoal: Goal) {
    this.goalsSignal.update(goals =>
      goals.map(g => g.id === updatedGoal.id ? updatedGoal : g)
    );
  }

  deleteGoal(id: string) {
    this.goalsSignal.update(goals => goals.filter(g => g.id !== id));
  }

  getGoalById(id: string) {
    return this.goalsSignal().find(g => g.id === id);
  }
}
