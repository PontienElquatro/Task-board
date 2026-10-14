import { Injectable, signal, inject, effect, untracked } from '@angular/core';
import { STORAGE_PROVIDER } from '../providers/storage.provider';
import { Goal } from '../models';
@Injectable({ providedIn: 'root' })
export class GoalService {
  private readonly storage = inject(STORAGE_PROVIDER);
  private readonly key = 'mytaskboard_goals';
  readonly loadFailed = signal(false);
  private readonly state = signal<Goal[]>(this.load());
  readonly goals = this.state.asReadonly();
  constructor() { if (this.storage.contextVersion) effect(() => { this.storage.contextVersion!(); untracked(() => { this.loadFailed.set(false); this.state.set(this.load()); }); }); }
  private load(): Goal[] {
    try {
      const data = this.storage.getItem<unknown>(this.key);
      if (data === null) return [];
      if (!Array.isArray(data) || !data.every(g => g && typeof g.id === 'string' && typeof g.title === 'string')) throw new Error('Objectifs invalides.');
      return data;
    } catch { this.loadFailed.set(true); return []; }
  }
  private commit(goals: Goal[]) {
    if (this.loadFailed()) throw new Error('Objectifs illisibles : aucune donnée remplacée.');
    this.storage.setItem(this.key, goals); this.state.set(goals);
  }
  addGoal(goal: Omit<Goal, 'id'>) { this.commit([...this.goals(), { ...goal, id: crypto.randomUUID() }]); }
  updateGoal(goal: Goal) { this.commit(this.goals().map(g => g.id === goal.id ? goal : g)); }
  deleteGoal(id: string) { this.commit(this.goals().filter(g => g.id !== id)); }
  getGoalById(id: string) { return this.goals().find(g => g.id === id); }
}
