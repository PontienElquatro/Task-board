export type Status = 'todo' | 'in-progress' | 'done';
export type Priority = 'low' | 'medium' | 'high';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  subTasks: SubTask[];
  goalId?: string;
  createdAt: Date;
  startDate?: Date;
  dueDate?: Date;
  userId: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  userId: string;
  color?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
}
