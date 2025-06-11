export type UserRole = 'free' | 'pro';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdObjectives: number;
}