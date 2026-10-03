import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({selector:'app-page-shell', standalone:true, imports:[RouterLink,RouterLinkActive], template:`
<main id="main-content" class="mx-auto min-h-[calc(100dvh-4rem)] max-w-6xl p-4 text-gray-900 dark:text-gray-100 sm:p-8">
  <nav aria-label="Navigation principale" class="mb-8 flex flex-wrap gap-2 text-sm [&>a]:min-h-11 [&>a]:rounded-lg [&>a]:px-4 [&>a]:py-3 [&>a]:hover:bg-gray-100 dark:[&>a]:hover:bg-gray-800">
    <a routerLink="/board">Tableau</a><a routerLink="/dashboard">Vue d’ensemble</a><a routerLink="/projects" routerLinkActive="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200">Projets</a><a routerLink="/calendar" routerLinkActive="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200">Calendrier</a><a routerLink="/team" routerLinkActive="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200">Équipe</a><a routerLink="/settings" routerLinkActive="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200">Paramètres</a>
  </nav>
  <header class="mb-8"><p class="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-700 dark:text-blue-300">Ma’at · Votre espace</p><h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">{{title}}</h1><p class="mt-4 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">{{description}}</p></header>
  <ng-content />
  <footer class="mt-12 flex flex-wrap gap-4 border-t border-gray-200 pt-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300 [&>a]:min-h-11 [&>a]:py-3 [&>a]:hover:text-blue-600"><a routerLink="/presentation">Découvrir Ma’at</a><a routerLink="/help">Aide</a><a routerLink="/privacy">Confidentialité</a><a routerLink="/terms">Conditions</a></footer>
</main>`})
export class PageShellComponent { @Input() title=''; @Input() description=''; }
