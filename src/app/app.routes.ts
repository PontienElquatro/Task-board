import { Routes } from '@angular/router';
import { BRAND } from './core/brand';
export const routes: Routes = [
  { path: 'admin', title: 'Administration · ' + BRAND.name, loadComponent: () => import('./admin/admin.component').then(m => m.AdminComponent) },
  { path: '', redirectTo: 'board', pathMatch: 'full' },
  { path: 'login', title: 'Mon compte · ' + BRAND.name, loadComponent: () => import('./login/login.component').then(m => m.LoginComponent) },
  { path: 'board', title: 'Mon tableau · ' + BRAND.name, loadComponent: () => import('./kanban-board/kanban-board.component').then(m => m.KanbanBoardComponent) },
  { path: 'dashboard', title: 'Vue d’ensemble · ' + BRAND.name, loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent) },
  { path: 'presentation', title: 'Découvrir Ma’at', loadComponent: () => import('./pages/workspace-pages.component').then(m => m.PresentationComponent) },
  { path: 'settings', title: 'Profil et paramètres · Ma’at', loadComponent: () => import('./pages/workspace-pages.component').then(m => m.SettingsComponent) },
  { path: 'projects', title: 'Mes projets · Ma’at', loadComponent: () => import('./pages/workspace-pages.component').then(m => m.ProjectsComponent) },
  { path: 'calendar', title: 'Calendrier · Ma’at', loadComponent: () => import('./pages/workspace-pages.component').then(m => m.CalendarComponent) },
  { path: 'team', title: 'Équipe · Ma’at', loadComponent: () => import('./pages/workspace-pages.component').then(m => m.TeamComponent) },
  { path: 'help', title: 'Aide · Ma’at', loadComponent: () => import('./pages/workspace-pages.component').then(m => m.HelpComponent) },
  { path: 'privacy', title: 'Confidentialité · Ma’at', loadComponent: () => import('./pages/workspace-pages.component').then(m => m.PrivacyComponent) },
  { path: 'terms', title: 'Conditions · Ma’at', loadComponent: () => import('./pages/workspace-pages.component').then(m => m.TermsComponent) },
  { path: '**', title: 'Page introuvable · Ma’at', loadComponent: () => import('./pages/workspace-pages.component').then(m => m.NotFoundComponent) }
];
