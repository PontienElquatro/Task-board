import { Routes } from '@angular/router';
import { KanbanBoardComponent } from './kanban-board/kanban-board.component';
import { LoginComponent } from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';

export const routes: Routes = [
  { path: '', redirectTo: 'board', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'board', component: KanbanBoardComponent },
  { path: 'dashboard', component: DashboardComponent },
];
