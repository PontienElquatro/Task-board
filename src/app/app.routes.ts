import { Routes } from '@angular/router';
import { BRAND } from './core/brand';
import { adminRouteGuard } from './admin/admin-route.guard';
export const routes: Routes = [
  {
    path: 'admin/settings',
    canActivate: [adminRouteGuard],
    title: 'Mon profil administrateur · Ma’at',
    loadComponent: () => import('./pages/workspace-pages.component')
      .then(m => m.SettingsComponent)
  },
  { path: 'team-projects', title: 'Projets d’équipe · Ma’at', loadComponent: () => import('./pages/shared-projects.component').then(m => m.SharedProjectsComponent) },
  { path: 'admin', canActivate:[adminRouteGuard], title: 'Administration · ' + BRAND.name, loadComponent: () => import('./admin/admin.component').then(m => m.AdminComponent) },
  { path: 'access-denied', title: 'Accès refusé · Ma’at', loadComponent: () => import('./admin/admin-access-denied.component').then(m => m.AdminAccessDeniedComponent) },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', title: 'Accueil · Ma’at', data: {publicPage:'home'}, loadComponent: () => import('./pages/public-pages.component').then(m => m.PublicPagesComponent) },
  { path: 'about', title: 'À propos · Ma’at', data: {publicPage:'about'}, loadComponent: () => import('./pages/public-pages.component').then(m => m.PublicPagesComponent) },
  { path: 'contact', title: 'Contact · Ma’at', loadComponent: () => import('./pages/public-contact.component').then(m => m.PublicContactComponent) },
  { path: 'login', title: 'Mon compte · ' + BRAND.name, loadComponent: () => import('./login/login.component').then(m => m.LoginComponent) },
  { path: 'board', title: 'Mon tableau · ' + BRAND.name, loadComponent: () => import('./kanban-board/kanban-board.component').then(m => m.KanbanBoardComponent) },
  { path: 'dashboard', title: 'Vue d’ensemble · ' + BRAND.name, loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent) },
  { path: 'presentation', title: 'Fonctionnalités · Ma’at', data: {publicPage:'features'}, loadComponent: () => import('./pages/public-pages.component').then(m => m.PublicPagesComponent) },
  { path: 'settings', title: 'Profil et paramètres · Ma’at', loadComponent: () => import('./pages/workspace-pages.component').then(m => m.SettingsComponent) },
  { path: 'projects', title: 'Mes projets · Ma’at', loadComponent: () => import('./pages/workspace-pages.component').then(m => m.ProjectsComponent) },
  { path: 'calendar', title: 'Calendrier · Ma’at', loadComponent: () => import('./pages/workspace-pages.component').then(m => m.CalendarComponent) },
  { path: 'team', title: 'Équipe · Ma’at', loadComponent: () => import('./pages/workspace-pages.component').then(m => m.TeamComponent) },
  { path: 'help', title: 'Aide · Ma’at', loadComponent: () => import('./pages/workspace-pages.component').then(m => m.HelpComponent) },
  { path: 'privacy', title: 'Confidentialité · Ma’at', loadComponent: () => import('./pages/workspace-pages.component').then(m => m.PrivacyComponent) },
  { path: 'terms', title: 'Conditions · Ma’at', loadComponent: () => import('./pages/workspace-pages.component').then(m => m.TermsComponent) },
  { path: '**', title: 'Page introuvable · Ma’at', loadComponent: () => import('./pages/workspace-pages.component').then(m => m.NotFoundComponent) }
];
