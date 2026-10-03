import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CloudStorageProvider } from '../providers/cloud-storage.provider';
import { SyncConflictComponent } from '../shared/sync-conflict/sync-conflict.component';
import { DeviceRestoreComponent } from '../shared/device-restore/device-restore.component';
import { BrandComponent } from '../shared/brand/brand.component';
@Component({selector:'app-account-bar',standalone:true,imports:[CommonModule,RouterLink,SyncConflictComponent,DeviceRestoreComponent,BrandComponent],template: `
<app-sync-conflict *ngIf="cloud.conflict()" />
<header class="sticky top-0 z-50 border-b border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-800 sm:px-6" aria-label="Compte et sauvegarde">
  <div class="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-2">
    <a routerLink="/board" class="flex min-h-11 items-center gap-2 rounded-lg font-semibold" aria-label="Ma’at — Tableau"><app-brand [compact]="true" /> Ma’at</a>
    <div class="flex min-w-0 flex-wrap items-center gap-2">
      <span class="max-w-56 truncate text-xs text-gray-600 dark:text-gray-300" role="status" aria-live="polite" [title]="cloud.status()">{{cloud.auth.initializing() ? 'Vérification de votre session…' : cloud.status() === 'Synchronisé avec votre compte' ? '✓ Sauvegardé' : cloud.status()}}</span>
      <details class="relative" #accountMenu (keydown.escape)="accountMenu.open=false">
        <summary class="flex min-h-11 max-w-48 cursor-pointer list-none items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-gray-600 dark:hover:bg-gray-700 [&::-webkit-details-marker]:hidden"><span class="truncate">{{cloud.auth.displayName()}}</span><span aria-hidden="true">⌄</span></summary>
        <div class="absolute right-0 z-50 mt-2 grid max-h-[70dvh] w-72 max-w-[calc(100vw-2rem)] gap-2 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-600 dark:bg-gray-800">
          <p class="break-words text-sm font-semibold">{{cloud.auth.displayName()}}</p>
          <a class="secondary" routerLink="/login" (click)="accountMenu.open=false">{{cloud.auth.user() ? 'Mon compte' : 'Connexion / Inscription'}}</a>
          <a class="quiet min-h-11" routerLink="/settings" (click)="accountMenu.open=false">Profil et paramètres</a>
          <a class="quiet min-h-11" routerLink="/projects" (click)="accountMenu.open=false">Mes projets</a>
          <a class="quiet min-h-11" routerLink="/calendar" (click)="accountMenu.open=false">Calendrier</a>
          <a class="quiet min-h-11" routerLink="/team" (click)="accountMenu.open=false">Équipe</a>
          <a class="quiet min-h-11" routerLink="/help" (click)="accountMenu.open=false">Aide et démarrage</a>
          <a class="quiet min-h-11" routerLink="/presentation" (click)="accountMenu.open=false">Découvrir Ma’at</a>
          <a *ngIf="cloud.auth.user()" class="quiet min-h-11" routerLink="/admin" (click)="accountMenu.open=false">Administration</a>
          <details><summary class="min-h-11 cursor-pointer rounded-lg p-2 text-sm">Sauvegarde et récupération</summary><div class="grid gap-2 pt-2">
            <p class="text-xs text-gray-600 dark:text-gray-300">{{cloud.localBackupStatus()}}</p>
            <button *ngIf="cloud.auth.user()" class="secondary" (click)="cloud.sync()">Réessayer la synchronisation</button>
            <button *ngIf="cloud.conflict()" class="secondary" (click)="cloud.reloadCloud()">Recharger en conservant une copie</button>
            <button *ngIf="cloud.auth.user()" class="secondary" (click)="cloud.exportRecoveryBackup()">Sauvegarde de secours</button>
            <button class="secondary" (click)="cloud.exportDeviceCopies()">Exporter les copies de cet appareil</button>
            <button class="secondary" [attr.aria-expanded]="restoreOpen" (click)="restoreOpen=!restoreOpen; accountMenu.open=false">Récupérer une copie</button>
          </div></details>
        </div>
      </details>
      <button *ngIf="cloud.auth.user()" class="secondary min-h-11 text-sm" [disabled]="signingOut()" (click)="signOut()">{{signingOut() ? 'Déconnexion…' : 'Déconnexion'}}</button>
    </div>
  </div>
  <p *ngIf="cloud.auth.sessionError() || logoutError()" role="alert" class="mx-auto mt-2 max-w-screen-2xl rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{{cloud.auth.sessionError() || logoutError()}}</p>
  <div *ngIf="syncNeedsAttention()" role="alert" class="mx-auto mt-2 flex max-w-screen-2xl flex-wrap items-center justify-between gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200"><span>{{cloud.status()}}</span><button class="secondary min-h-11" (click)="cloud.sync()">Réessayer</button></div>
</header>
<app-device-restore *ngIf="restoreOpen" />`})
export class AccountBarComponent {
  readonly cloud=inject(CloudStorageProvider); restoreOpen=false;
  readonly syncNeedsAttention=computed(()=>/indisponible|réessayer|différée|illisible/i.test(this.cloud.status()));
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
