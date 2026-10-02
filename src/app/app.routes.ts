import { Routes } from '@angular/router';
import { BRAND } from './core/brand';
export const routes: Routes = [
  { path: 'admin', title: 'Administration · ' + BRAND.name, loadComponent: () => import('./admin/admin.component').then(m => m.AdminComponent) },
  { path: '', redirectTo: 'board', pathMatch: 'full' },
  { path: 'login', title: 'Mon compte · ' + BRAND.name, loadComponent: () => import('./login/login.component').then(m => m.LoginComponent) },
  { path: 'board', title: 'Mon tableau · ' + BRAND.name, loadComponent: () => import('./kanban-board/kanban-board.component').then(m => m.KanbanBoardComponent) },
  { path: 'dashboard', title: 'Vue d’ensemble · ' + BRAND.name, loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent) },
  { path: '**', redirectTo: 'board' }
];
