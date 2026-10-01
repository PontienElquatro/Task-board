import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CloudStorageProvider } from '../providers/cloud-storage.provider';
@Component({selector:'app-account-bar',standalone:true,imports:[CommonModule,RouterLink],template: `
<div class="account-bar" *ngIf="!cloud.auth.initializing()">
  <span>{{ cloud.auth.user() ? 'Compte connecté' : 'Espace personnel local' }} · {{ cloud.status() }}</span>
  <div class="toolbar-actions">
    <a *ngIf="cloud.auth.user()" class="quiet" routerLink="/admin">Administration</a>
    <ng-container *ngIf="cloud.auth.user()"><button class="quiet" (click)="cloud.sync()">Synchroniser</button><button *ngIf="cloud.conflict()" class="secondary" (click)="cloud.reloadCloud()">Recharger le cloud</button></ng-container>
    <a class="secondary" routerLink="/login">{{ cloud.auth.user() ? 'Mon compte' : 'Connexion / Inscription' }}</a>
  </div>
</div>`})
export class AccountBarComponent { readonly cloud=inject(CloudStorageProvider); }
