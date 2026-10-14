import { Component, inject, signal, HostListener, ElementRef, ViewChild } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BrandComponent } from './brand/brand.component';
import { ThemeService } from '../services/theme.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-public-header', standalone: true,
  imports: [RouterLink, RouterLinkActive, BrandComponent, IconComponent],
  styleUrl: './public-navigation.component.css',
  template: `
    <header class="visitor-header">
      <div class="visitor-shell">
        <a routerLink="/home" class="visitor-brand" aria-label="Ma’at — Accueil" (click)="closeMenu()"><span class="visitor-mark"><app-brand [compact]="true" /></span><span class="visitor-brand-name">Ma’at</span></a>
        <nav id="visitor-navigation" aria-label="Navigation visiteurs" [class.visitor-menu-open]="mobileOpen()" class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center">
          <a routerLink="/home" routerLinkActive="visitor-active" ariaCurrentWhenActive="page" (click)="closeMenu(true)">Accueil</a>
          <a routerLink="/presentation" routerLinkActive="visitor-active" ariaCurrentWhenActive="page" (click)="closeMenu(true)">Fonctionnalités</a>
          <a routerLink="/about" routerLinkActive="visitor-active" ariaCurrentWhenActive="page" (click)="closeMenu(true)">À propos</a>
          <a routerLink="/contact" routerLinkActive="visitor-active" ariaCurrentWhenActive="page" (click)="closeMenu(true)">Contact</a>
        </nav>
        <div class="visitor-actions">
          <button type="button" class="visitor-theme" [attr.aria-pressed]="theme.darkMode()"
            [attr.aria-label]="theme.darkMode() ? 'Activer le thème clair' : 'Activer le thème sombre'"
            [attr.title]="theme.darkMode() ? 'Activer le thème clair' : 'Activer le thème sombre'"
            (click)="theme.toggleDarkMode()">
            <app-icon [name]="theme.darkMode() ? 'sun' : 'moon'" />
          </button>
          <a routerLink="/login" class="visitor-login" (click)="closeMenu()">Se connecter <app-icon name="arrow-right" /></a>
          <button #menuToggle type="button" class="visitor-menu-toggle" aria-controls="visitor-navigation"
            [attr.aria-expanded]="mobileOpen()" [attr.aria-label]="mobileOpen() ? 'Fermer le menu' : 'Ouvrir le menu'"
            (click)="mobileOpen.set(!mobileOpen())"><app-icon [name]="mobileOpen() ? 'close' : 'menu'" /></button>
        </div>
      </div>
    </header>`
})
export class PublicHeaderComponent {
  readonly theme = inject(ThemeService);
  readonly mobileOpen = signal(false);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  @ViewChild('menuToggle') private toggle?: ElementRef<HTMLButtonElement>;
  constructor(){inject(Router).events.pipe(takeUntilDestroyed()).subscribe(event=>{if(event instanceof NavigationEnd)this.closeMenu();});}
  closeMenu(returnFocus=false) {
    const wasOpen=this.mobileOpen();this.mobileOpen.set(false);
    if(wasOpen && returnFocus)this.toggle?.nativeElement.focus();
  }
  @HostListener('document:keydown.escape',['$event']) escape(event:Event) {
    if(!this.mobileOpen())return;event.preventDefault();event.stopPropagation();this.closeMenu(true);
  }
  @HostListener('document:click',['$event']) outside(event:MouseEvent) {
    if(this.mobileOpen() && event.target instanceof Node && !this.element.nativeElement.contains(event.target))this.closeMenu();
  }
}

@Component({
  selector: 'app-public-footer', standalone: true, imports: [RouterLink],
  styleUrl: './public-navigation.component.css',
  template: `
    <footer class="visitor-footer">
      <div class="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <p class="font-semibold">Ma'at by El_Quatro Technology</p>
        <p class="mt-2 text-sm visitor-footer-muted">De petites tâches. De grandes avancées.</p>
        <nav aria-label="Informations et assistance" class="my-4 flex flex-wrap gap-x-5 gap-y-2 text-sm [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center">
          <a routerLink="/about">À propos</a><a routerLink="/contact">Contact</a>
          <a routerLink="/help">Aide</a><a routerLink="/privacy">Confidentialité</a><a routerLink="/terms">Conditions</a>
        </nav>
        <p class="text-sm visitor-footer-muted">© {{year}} El_Quatro Technology — Ma’at.</p>
      </div>
    </footer>`
})
export class PublicFooterComponent { readonly year = new Date().getFullYear(); }
