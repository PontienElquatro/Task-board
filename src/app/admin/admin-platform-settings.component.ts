import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { PlatformSettingsService } from '../services/platform-settings.service';
import { AdminAccess } from './admin-access.component';
@Component({selector:'app-admin-platform-settings',standalone:true,imports:[CommonModule,FormsModule],template:`
<section class="mt-6 rounded-2xl border border-blue-100 bg-white p-5 dark:border-indigo-900 dark:bg-gray-900">
  <h2 class="text-xl font-semibold">Paramètres de la plateforme</h2>
  <p class="mt-2 text-sm">Ces informations sont publiques et partagées par tous les comptes. Elles ne modifient pas vos préférences personnelles.</p>
  <p *ngIf="error()" role="alert" class="mt-4 text-red-700 dark:text-red-300">{{error()}}</p>
  <p *ngIf="notice()" role="status" class="mt-4 text-blue-700 dark:text-blue-300">{{notice()}}</p>
  <button class="secondary mt-4 min-h-11" [disabled]="busy()" (click)="load()">Actualiser les paramètres</button>
  <form *ngIf="loaded()" class="mt-5 grid gap-4" (ngSubmit)="save()">
    <label class="grid gap-2 text-sm">Email de contact public<input type="email" name="email" class="min-h-11 rounded-xl border bg-transparent p-3" [(ngModel)]="email" maxlength="254" [readonly]="!canManage()" /></label>
    <label class="grid gap-2 text-sm">Annonce publique (vide pour masquer)<textarea name="announcement" class="rounded-xl border bg-transparent p-3" [(ngModel)]="announcement" maxlength="500" [readonly]="!canManage()"></textarea></label>
    <ng-container *ngIf="canManage()"><label class="grid gap-2 text-sm">Motif du changement<textarea name="reason" class="rounded-xl border bg-transparent p-3" [(ngModel)]="reason" minlength="10" maxlength="500" required></textarea></label>
    <p class="text-sm">Vérifiez votre connexion dans « Rôles et accès » ou reconnectez-vous avant une modification sensible.</p>
    <button class="primary min-h-11 justify-self-start" [disabled]="busy()||reason.trim().length<10">Enregistrer les paramètres publics</button></ng-container>
    <p *ngIf="!canManage()" class="text-sm">Votre rôle permet la consultation uniquement.</p>
  </form>
</section>`})
export class AdminPlatformSettingsComponent implements OnInit {
  @Input({required:true}) access!:AdminAccess;
  private readonly auth=inject(AuthService);private readonly platform=inject(PlatformSettingsService);
  readonly busy=signal(false);readonly loaded=signal(false);readonly error=signal('');readonly notice=signal('');
  email='';announcement='';reason='';version=0;
  canManage(){return this.access.isPrincipal||this.access.permissions.includes('settings_manage');}
  ngOnInit(){void this.load();}
  async load(){this.busy.set(true);this.error.set('');try{const result=await this.auth.client.functions.invoke('taskboard-admin',{body:{action:'platform_settings'}});if(result.error||!result.data?.version)throw new Error();this.email=result.data.support_email;this.announcement=result.data.announcement;this.version=result.data.version;this.loaded.set(true);}catch{this.error.set('Paramètres indisponibles. Réessayez.');}finally{this.busy.set(false);}}
  async save(){if(this.busy()||!this.canManage()||this.reason.trim().length<10)return;this.busy.set(true);this.error.set('');this.notice.set('');try{const result=await this.auth.client.functions.invoke('taskboard-admin',{body:{action:'platform_settings_update',supportEmail:this.email.trim(),announcement:this.announcement.trim(),expectedVersion:this.version,reason:this.reason.trim()}});if(result.error||!result.data?.version)throw new Error();this.version=result.data.version;this.reason='';await this.platform.refresh();this.notice.set('Paramètres publiés et changement journalisé.');}catch{this.error.set('Modification refusée. Vérifiez votre connexion récente et actualisez pour éviter d’écraser une modification concurrente.');}finally{this.busy.set(false);}}
}
