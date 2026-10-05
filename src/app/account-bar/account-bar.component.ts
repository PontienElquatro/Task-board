import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CloudStorageProvider } from '../providers/cloud-storage.provider';
import { SyncConflictComponent } from '../shared/sync-conflict/sync-conflict.component';
import { DeviceRestoreComponent } from '../shared/device-restore/device-restore.component';
import { BrandComponent } from '../shared/brand/brand.component';
import { IconComponent } from '../shared/icon.component';
import { cloudIndicator } from '../core/cloud-indicator';
import { NotificationsComponent } from '../shared/notifications.component';
@Component({selector:'app-account-bar',standalone:true,imports:[IconComponent,CommonModule,RouterLink,SyncConflictComponent,DeviceRestoreComponent,BrandComponent,NotificationsComponent],template: `
<app-sync-conflict *ngIf="cloud.conflict()" />
<header class="sticky top-0 z-50 border-b border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-800 sm:px-6" aria-label="Compte et sauvegarde">
  <div class="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-2">
    <a routerLink="/board" class="flex min-h-11 items-center gap-2 rounded-lg font-semibold" aria-label="Ma’at — Tableau"><app-brand [compact]="true" /> Ma’at</a>
    <div class="flex min-w-0 flex-wrap items-center gap-2">
      <app-notifications />
      <span class="flex min-h-11 min-w-11 items-center justify-center rounded-xl transition-colors duration-200 motion-reduce:transition-none" [ngClass]="saveState()==='saved' ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' : saveState()==='error' ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' : saveState()==='local' ? 'bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400' : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'" role="status" aria-live="polite" [title]="saveLabel()"><app-icon [name]="saveState()==='saved' ? 'cloud-check' : saveState()==='error' ? 'cloud-error' : 'cloud'" /><span class="sr-only">{{saveLabel()}}</span></span>
      <details class="group/account relative" #accountMenu (keydown.escape)="accountMenu.open=false">
        <summary class="flex min-h-11 max-w-48 cursor-pointer list-none items-center gap-2 rounded-xl border border-blue-100 bg-white px-3 text-sm transition-all duration-200 hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-blue-900 dark:bg-gray-800 dark:hover:border-blue-600 dark:hover:bg-blue-950 motion-reduce:transition-none [&::-webkit-details-marker]:hidden"><img *ngIf="cloud.auth.avatarUrl()" [src]="cloud.auth.avatarUrl()" alt="" class="h-7 w-7 rounded-full object-cover ring-2 ring-blue-100 transition-transform duration-200 group-hover/account:scale-105 dark:ring-blue-900 motion-reduce:transform-none motion-reduce:transition-none" /><span *ngIf="!cloud.auth.avatarUrl()" class="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-200">{{cloud.auth.initials()}}</span><span class="truncate">{{cloud.auth.displayName()}}</span><app-icon name="chevron" class="rounded-md bg-indigo-50 p-1 text-indigo-700 dark:bg-indigo-950 transition-transform duration-200 group-open/account:rotate-180 dark:text-blue-300 motion-reduce:transform-none motion-reduce:transition-none" /></summary>
        <div class="absolute right-0 z-50 mt-3 max-h-[calc(100dvh-6rem)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-blue-100 bg-white p-2 shadow-xl dark:border-indigo-900 dark:bg-gray-900">
          <div class="mb-2 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-4 dark:from-blue-950 dark:to-indigo-950"><p class="text-xs font-medium text-blue-700 dark:text-blue-300">Mon espace Ma’at</p><p class="mt-2 break-words text-sm font-semibold text-indigo-950 dark:text-gray-100">{{cloud.auth.displayName()}}</p><p *ngIf="cloud.auth.user()?.email" class="mt-1 break-words text-xs text-gray-500 dark:text-gray-400">{{cloud.auth.user()?.email}}</p></div>
          <nav class="grid gap-1" aria-label="Menu du compte">
          <a routerLink="/login" (click)="accountMenu.open=false" class="group/link flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-indigo-950 transition-colors duration-200 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-100 dark:hover:bg-indigo-950 motion-reduce:transition-none"><span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-transform duration-200 group-hover/link:scale-105 dark:bg-indigo-950 dark:text-blue-300 motion-reduce:transform-none"><app-icon name="user" /></span>{{cloud.auth.user() ? 'Mon compte' : 'Connexion / Inscription'}}</a>
          <a routerLink="/settings" (click)="accountMenu.open=false" class="group/link flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-indigo-950 transition-colors duration-200 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-100 dark:hover:bg-indigo-950 motion-reduce:transition-none"><span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-transform duration-200 group-hover/link:scale-105 dark:bg-indigo-950 dark:text-blue-300 motion-reduce:transform-none"><app-icon name="settings" /></span>Profil et paramètres</a>
          <a routerLink="/projects" (click)="accountMenu.open=false" class="group/link flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-indigo-950 transition-colors duration-200 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-100 dark:hover:bg-indigo-950 motion-reduce:transition-none"><span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-transform duration-200 group-hover/link:scale-105 dark:bg-indigo-950 dark:text-blue-300 motion-reduce:transform-none"><app-icon name="folder" /></span>Mes projets</a>
          <a routerLink="/calendar" (click)="accountMenu.open=false" class="group/link flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-indigo-950 transition-colors duration-200 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-100 dark:hover:bg-indigo-950 motion-reduce:transition-none"><span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-transform duration-200 group-hover/link:scale-105 dark:bg-indigo-950 dark:text-blue-300 motion-reduce:transform-none"><app-icon name="calendar" /></span>Calendrier</a>
          <a routerLink="/team" (click)="accountMenu.open=false" class="group/link flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-indigo-950 transition-colors duration-200 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-100 dark:hover:bg-indigo-950 motion-reduce:transition-none"><span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-transform duration-200 group-hover/link:scale-105 dark:bg-indigo-950 dark:text-blue-300 motion-reduce:transform-none"><app-icon name="team" /></span>Équipe</a>
          <a routerLink="/help" (click)="accountMenu.open=false" class="group/link flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-indigo-950 transition-colors duration-200 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-100 dark:hover:bg-indigo-950 motion-reduce:transition-none"><span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-transform duration-200 group-hover/link:scale-105 dark:bg-indigo-950 dark:text-blue-300 motion-reduce:transform-none"><app-icon name="help" /></span>Aide et démarrage</a>
          <a routerLink="/presentation" (click)="accountMenu.open=false" class="group/link flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-indigo-950 transition-colors duration-200 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-100 dark:hover:bg-indigo-950 motion-reduce:transition-none"><span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-transform duration-200 group-hover/link:scale-105 dark:bg-indigo-950 dark:text-blue-300 motion-reduce:transform-none"><app-brand [compact]="true" /></span>Découvrir Ma’at</a>
          <a *ngIf="cloud.auth.user()" routerLink="/admin" (click)="accountMenu.open=false" class="group/link flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-indigo-950 transition-colors duration-200 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-100 dark:hover:bg-indigo-950 motion-reduce:transition-none"><span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-transform duration-200 group-hover/link:scale-105 dark:bg-indigo-950 dark:text-blue-300 motion-reduce:transform-none"><app-icon name="shield" /></span>Administration</a>
          </nav>
          <details class="group/backup mt-2 border-t border-blue-100 pt-2 dark:border-indigo-900"><summary class="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-indigo-950 hover:bg-blue-50 dark:text-gray-100 dark:hover:bg-indigo-950 [&::-webkit-details-marker]:hidden"><span class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"><app-icon name="cloud" /></span><span class="flex-1">Sauvegardes</span><app-icon name="chevron" class="text-blue-600 transition-transform duration-200 group-open/backup:rotate-180 motion-reduce:transition-none" /></summary><div class="grid gap-2 pt-2">
            <p class="text-xs text-gray-600 dark:text-gray-300">{{cloud.localBackupStatus()}}</p>
            <button *ngIf="cloud.auth.user()" class="secondary" (click)="cloud.sync()">Réessayer la synchronisation</button>
            <button *ngIf="cloud.conflict()" class="secondary" (click)="cloud.reloadCloud()">Recharger en conservant une copie</button>
            <button *ngIf="cloud.auth.user()" class="secondary" (click)="cloud.exportRecoveryBackup()">Sauvegarde de secours</button>
            <button class="secondary" (click)="cloud.exportDeviceCopies()">Exporter les copies de cet appareil</button>
            <button class="secondary" [attr.aria-expanded]="restoreOpen" (click)="restoreOpen=!restoreOpen; accountMenu.open=false">Récupérer une copie</button>
          </div></details>
        </div>
      </details>
      <button *ngIf="cloud.auth.user()" class="group/logout inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-100 bg-white px-4 text-sm font-medium text-red-700 transition-all duration-200 hover:border-red-300 hover:bg-red-50 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:bg-gray-800 dark:text-red-200 dark:hover:border-red-600 dark:hover:bg-red-950 motion-reduce:transition-none" [disabled]="signingOut()" (click)="signOut()"><app-icon name="logout" class="text-red-600 transition-transform duration-200 group-hover/logout:translate-x-0.5 group-focus-visible/logout:translate-x-0.5 dark:text-red-300 motion-reduce:transform-none motion-reduce:transition-none" /><span>{{signingOut() ? 'Déconnexion…' : 'Déconnexion'}}</span></button>
    </div>
  </div>
  <p *ngIf="cloud.auth.sessionError() || logoutError()" role="alert" class="mx-auto mt-2 max-w-screen-2xl rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{{cloud.auth.sessionError() || logoutError()}}</p>
  <div *ngIf="syncNeedsAttention()" role="alert" class="mx-auto mt-2 flex max-w-screen-2xl flex-wrap items-center justify-between gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200"><span>{{cloud.status()}}</span><button class="secondary min-h-11" (click)="cloud.sync()">Réessayer</button></div>
</header>
<app-device-restore *ngIf="restoreOpen" />`})
export class AccountBarComponent {
  readonly cloud=inject(CloudStorageProvider); restoreOpen=false;
  readonly syncNeedsAttention=computed(()=>/indisponible|réessayer|différée|illisible/i.test(this.cloud.status()));
  readonly saveState=computed(()=>cloudIndicator(this.cloud.status(),this.cloud.auth.initializing(),!!this.cloud.auth.user(),!!this.cloud.conflict(),this.cloud.auth.sessionError()));
  readonly saveLabel=computed(()=>this.cloud.auth.initializing() ? 'Vérification de la sauvegarde…' : this.cloud.auth.sessionError() || (this.saveState()==='saved' ? 'Sauvegarde cloud confirmée' : this.saveState()==='local' ? 'Mode local — aucune sauvegarde cloud' : this.cloud.status()));
  readonly signingOut=signal(false); readonly logoutError=signal('');
  async signOut() {
    if(this.signingOut()) return;
    if(!this.cloud.ready() || this.cloud.conflict()) {
      this.logoutError.set('Attendez le chargement ou résolvez le conflit avant de vous déconnecter.'); return;
    }
    this.signingOut.set(true); this.logoutError.set('');
    try {
      await this.cloud.sync();
      if(this.cloud.status() !== 'Synchronisé avec votre compte') {
        this.logoutError.set('La sauvegarde cloud n’est pas confirmée. Exportez une copie avant de quitter votre compte.'); return;
      }
      await this.cloud.auth.signOut();
    } catch(error) {this.logoutError.set(error instanceof Error ? error.message : 'Déconnexion impossible.');}
    finally {this.signingOut.set(false);}
  }
}
