import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CloudStorageProvider } from '../providers/cloud-storage.provider';
import { SyncConflictComponent } from '../shared/sync-conflict/sync-conflict.component';
import { DeviceRestoreComponent } from '../shared/device-restore/device-restore.component';
@Component({selector:'app-account-bar',standalone:true,imports:[CommonModule,RouterLink,SyncConflictComponent,DeviceRestoreComponent],template: `
<app-sync-conflict *ngIf="cloud.conflict()" />
<div class="account-bar">
  <span role="status" aria-live="polite">{{ cloud.auth.initializing() ? 'Vérification de votre session…' : cloud.auth.displayName() + ' · ' + cloud.status() }}<small class="block text-xs text-gray-500 dark:text-gray-400">{{cloud.auth.sessionError() || cloud.localBackupStatus()}}</small></span>
  <div class="toolbar-actions min-w-0 flex-wrap gap-2">
    <a *ngIf="cloud.auth.user()" class="quiet" routerLink="/admin">Administration</a>
    <ng-container *ngIf="cloud.auth.user()"><button class="quiet" (click)="cloud.sync()">Synchroniser</button><button *ngIf="cloud.conflict()" class="secondary" (click)="cloud.reloadCloud()">Recharger en conservant une copie</button><button class="quiet" (click)="cloud.exportRecoveryBackup()">Sauvegarde de secours</button></ng-container>
    <button class="quiet" (click)="cloud.exportDeviceCopies()">Copies de cet appareil</button>
    <button class="quiet" [attr.aria-expanded]="restoreOpen" (click)="restoreOpen=!restoreOpen">Récupérer une copie</button>
    <a class="secondary" routerLink="/login">{{ cloud.auth.user() ? 'Mon compte' : 'Connexion / Inscription' }}</a>
    <button *ngIf="cloud.auth.user()" class="secondary min-h-11" [disabled]="signingOut()" (click)="signOut()">{{ signingOut() ? 'Déconnexion…' : 'Déconnexion' }}</button>
    <span *ngIf="logoutError()" role="alert">{{logoutError()}}</span>
  </div>
</div>
<app-device-restore *ngIf="restoreOpen" />`})
export class AccountBarComponent {
  readonly cloud=inject(CloudStorageProvider); restoreOpen=false;
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
