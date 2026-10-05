import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({selector:'app-page-shell', standalone:true, imports:[RouterLink], template:`
<main id="main-content" class="mx-auto min-h-[calc(100dvh-4rem)] max-w-6xl p-4 text-gray-900 dark:text-gray-100 sm:p-8">
  <header [class.hidden]="hideHeader" class="mb-6"><h1 class="text-2xl font-semibold tracking-tight">{{title}}</h1><p class="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">{{description}}</p></header>
  <ng-content />
  <footer class="mt-12 flex flex-wrap gap-4 border-t border-gray-200 pt-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300 [&>a]:min-h-11 [&>a]:py-3 [&>a]:hover:text-blue-600"><a routerLink="/presentation">Découvrir Ma’at</a><a routerLink="/help">Aide</a><a routerLink="/privacy">Confidentialité</a><a routerLink="/terms">Conditions</a></footer>
</main>`})
export class PageShellComponent { @Input() title=''; @Input() description=''; @Input() hideHeader=false; }
