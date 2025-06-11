// src/app/models/objective.model.ts

export type TaskStatus = 'todo' | 'in-progress' | 'done';

export interface SubTask {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  subTasks: SubTask[];
  timeSpent: number; // en minutes
  estimatedTime: number; // en minutes
}

// export interface Objective {
//   id: string;
//   title: string;
//   description: string;
//   tasks: Task[];
// }

export interface Objective {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  deadline?: Date;
  tasks: Task[];
}
