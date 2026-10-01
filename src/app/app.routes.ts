import { Routes } from '@angular/router';
export const routes: Routes = [
  { path: 'admin', title: 'Administration · MyTaskBoard', loadComponent: () => import('./admin/admin.component').then(m => m.AdminComponent) },
  { path: '', redirectTo: 'board', pathMatch: 'full' },
  { path: 'login', title: 'Mon compte · MyTaskBoard', loadComponent: () => import('./login/login.component').then(m => m.LoginComponent) },
  { path: 'board', title: 'Mon tableau · MyTaskBoard', loadComponent: () => import('./kanban-board/kanban-board.component').then(m => m.KanbanBoardComponent) },
  { path: 'dashboard', title: 'Vue d’ensemble · MyTaskBoard', loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent) },
  { path: '**', redirectTo: 'board' }
];
