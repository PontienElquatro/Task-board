import { SubTask } from './subtask.model';

export type TaskStatus = 'todo' | 'in-progress' | 'done';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  estimatedTime: number; // en minutes
  timeSpent: number;     // en minutes
  subTasks: SubTask[];
}
