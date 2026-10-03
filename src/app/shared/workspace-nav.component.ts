import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({selector:'app-workspace-nav',standalone:true,imports:[CommonModule,RouterLink,RouterLinkActive],template:`
<nav aria-label="Navigation principale" class="workspace-navigation">
 <p class="workspace-navigation-label">ESPACE DE TRAVAIL</p>
 <a *ngFor="let item of items" [routerLink]="item.path" routerLinkActive="workspace-link-active" ariaCurrentWhenActive="page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path [attr.d]="item.icon" stroke-linecap="round" stroke-linejoin="round" /></svg><span>{{item.label}}</span></a>
 <div class="workspace-navigation-help"><p>Un projet. Une prochaine action.</p><a routerLink="/help" routerLinkActive="workspace-link-active" ariaCurrentWhenActive="page">Aide et démarrage ↗</a></div>
</nav>`})
export class WorkspaceNavComponent {
 readonly items=[
 {path:'/board',label:'Mon tableau',icon:'M3 4h18v16H3z M9 4v16 M15 4v16'},
 {path:'/projects',label:'Mes projets',icon:'M3 7V4h7l2 3h9v13H3z'},
 {path:'/calendar',label:'Calendrier',icon:'M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4'},
 {path:'/dashboard',label:'Vue d’ensemble',icon:'M4 20h16 M6 16V9 M12 16V4 M18 16v-4'},
 {path:'/team',label:'Équipe',icon:'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M12 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M22 21v-3a4 4 0 0 0-3-4 M16 3a3 3 0 0 1 0 6'},
 {path:'/settings',label:'Paramètres',icon:'M4 6h16 M4 12h16 M4 18h16 M8 4v4 M16 10v4 M10 16v4'}];
}
