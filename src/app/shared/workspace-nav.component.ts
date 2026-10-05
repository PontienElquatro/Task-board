import { Component, inject } from '@angular/core';
import { IconComponent } from './icon.component';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

@Component({selector:'app-workspace-nav',standalone:true,imports:[IconComponent,CommonModule,RouterLink,RouterLinkActive],template:`
<nav aria-label="Navigation principale" class="workspace-navigation">
 <p class="workspace-navigation-label">ESPACE DE TRAVAIL</p>
 <a class="hidden lg:flex" *ngFor="let item of items" [routerLink]="item.path" routerLinkActive="workspace-link-active" ariaCurrentWhenActive="page"><app-icon [name]="item.symbol" /><span>{{item.label}}</span></a>
 <details class="w-full lg:hidden" #mobileNav (keydown.escape)="mobileNav.open=false"><summary class="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg px-2 text-sm font-semibold text-gray-900 dark:text-gray-100 [&::-webkit-details-marker]:hidden"><span>{{currentLabel()}}</span><span class="text-xs font-normal text-blue-700 dark:text-blue-300">Navigation <app-icon name="chevron" /></span></summary><div class="grid gap-2 border-t border-gray-200 pt-2 dark:border-gray-700"><a *ngFor="let item of items" class="flex min-h-11 items-center rounded-lg px-4 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800" [routerLink]="item.path" routerLinkActive="workspace-link-active" ariaCurrentWhenActive="page" (click)="mobileNav.open=false"><app-icon [name]="item.symbol" /><span class="ml-2">{{item.label}}</span></a><a routerLink="/help" class="flex min-h-11 items-center px-4 text-sm text-blue-700 dark:text-blue-300" (click)="mobileNav.open=false">Aide et démarrage</a></div></details>
 <div class="workspace-navigation-help"><p>Un projet. Une prochaine action.</p><a routerLink="/help" routerLinkActive="workspace-link-active" ariaCurrentWhenActive="page">Aide et démarrage ↗</a></div>
</nav>`})
export class WorkspaceNavComponent {
 private readonly router=inject(Router);
 currentLabel(){return this.items.find(item=>item.path===this.router.url.split(/[?#]/)[0])?.label ?? 'Mon espace';}
 readonly items=[
 {symbol:'team',path:'/team-projects',label:'Projets d’équipe',icon:'M3 7V4h7l2 3h9v13H3z'},
 {symbol:'board',path:'/board',label:'Mon tableau',icon:'M3 4h18v16H3z M9 4v16 M15 4v16'},
 {symbol:'folder',path:'/projects',label:'Mes projets',icon:'M3 7V4h7l2 3h9v13H3z'},
 {symbol:'calendar',path:'/calendar',label:'Calendrier',icon:'M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4'},
 {symbol:'chart',path:'/dashboard',label:'Vue d’ensemble',icon:'M4 20h16 M6 16V9 M12 16V4 M18 16v-4'},
 {symbol:'team',path:'/team',label:'Équipe',icon:'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M12 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M22 21v-3a4 4 0 0 0-3-4 M16 3a3 3 0 0 1 0 6'},
 {symbol:'settings',path:'/settings',label:'Paramètres',icon:'M4 6h16 M4 12h16 M4 18h16 M8 4v4 M16 10v4 M10 16v4'}];
}
