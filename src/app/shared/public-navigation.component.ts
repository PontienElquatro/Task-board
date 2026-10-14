import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BrandComponent } from './brand/brand.component';

@Component({
  selector: 'app-public-header', standalone: true,
  imports: [RouterLink, RouterLinkActive, BrandComponent],
  template: `
    <header class="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 p-4 sm:px-8">
        <a routerLink="/home" aria-label="Ma’at — Accueil"><app-brand [compact]="true" /></a>
        <nav aria-label="Navigation visiteurs" class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center">
          <a routerLink="/home" routerLinkActive="text-blue-600" ariaCurrentWhenActive="page">Accueil</a>
          <a routerLink="/presentation" routerLinkActive="text-blue-600" ariaCurrentWhenActive="page">Fonctionnalités</a>
          <a routerLink="/about" routerLinkActive="text-blue-600" ariaCurrentWhenActive="page">À propos</a>
          <a routerLink="/contact" routerLinkActive="text-blue-600" ariaCurrentWhenActive="page">Contact</a>
        </nav>
        <a routerLink="/login" class="secondary min-h-11">Se connecter</a>
      </div>
    </header>`
})
export class PublicHeaderComponent {}

@Component({
  selector: 'app-public-footer', standalone: true, imports: [RouterLink],
  template: `
    <footer class="border-t border-gray-200 dark:border-gray-700">
      <div class="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <p class="font-semibold">Ma'at by El_Quatro Technology</p>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">De petites tâches. De grandes avancées.</p>
        <nav aria-label="Informations et assistance" class="my-4 flex flex-wrap gap-x-5 gap-y-2 text-sm [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center">
          <a routerLink="/about">À propos</a><a routerLink="/contact">Contact</a>
          <a routerLink="/help">Aide</a><a routerLink="/privacy">Confidentialité</a><a routerLink="/terms">Conditions</a>
        </nav>
        <p class="text-sm text-gray-600 dark:text-gray-300">© {{year}} El_Quatro Technology — Ma’at.</p>
      </div>
    </footer>`
})
export class PublicFooterComponent { readonly year = new Date().getFullYear(); }
