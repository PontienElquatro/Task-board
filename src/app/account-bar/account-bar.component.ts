import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CloudStorageProvider } from '../providers/cloud-storage.provider';
import { SyncConflictComponent } from '../shared/sync-conflict/sync-conflict.component';
import { DeviceRestoreComponent } from '../shared/device-restore/device-restore.component';
@Component({selector:'app-account-bar',standalone:true,imports:[CommonModule,RouterLink,SyncConflictComponent,DeviceRestoreComponent],template: `
<app-sync-conflict *ngIf="cloud.conflict()" />
<div class="account-bar" *ngIf="!cloud.auth.initializing()">
  <span role="status" aria-live="polite">{{ cloud.auth.user() ? 'Compte connecté' : 'Espace personnel local' }} · {{ cloud.status() }}<small class="block text-xs text-gray-500 dark:text-gray-400">{{cloud.localBackupStatus()}}</small></span>
  <div class="toolbar-actions min-w-0 flex-wrap gap-2">
    <a *ngIf="cloud.auth.user()" class="quiet" routerLink="/admin">Administration</a>
    <ng-container *ngIf="cloud.auth.user()"><button class="quiet" (click)="cloud.sync()">Synchroniser</button><button *ngIf="cloud.conflict()" class="secondary" (click)="cloud.reloadCloud()">Recharger en conservant une copie</button><button class="quiet" (click)="cloud.exportRecoveryBackup()">Sauvegarde de secours</button></ng-container>
    <button class="quiet" (click)="cloud.exportDeviceCopies()">Copies de cet appareil</button>
    <button class="quiet" [attr.aria-expanded]="restoreOpen" (click)="restoreOpen=!restoreOpen">Récupérer une copie</button>
    <a class="secondary" routerLink="/login">{{ cloud.auth.user() ? 'Mon compte' : 'Connexion / Inscription' }}</a>
  </div>
</div>
<app-device-restore *ngIf="restoreOpen" />`})
export class AccountBarComponent { readonly cloud=inject(CloudStorageProvider); restoreOpen=false; }
