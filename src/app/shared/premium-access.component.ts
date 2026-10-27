import { Component, effect, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { UiFieldDirective } from './ui-field.directive';

interface PremiumStatus {
  trialStartedAt:string;trialEndsAt:string;trialActive:boolean;paidUntil:string|null;
  paidActive:boolean;active:boolean;pendingRequest:boolean;requestStatus:string|null;
  requestedTariff:string|null;requestCreatedAt:string|null;
}

@Component({selector:'app-premium-access',standalone:true,imports:[CommonModule,DatePipe,FormsModule,UiFieldDirective],template:`
<section class="mb-5 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900 dark:bg-indigo-950/40" aria-labelledby="premium-access-title">
 <div class="flex flex-wrap items-start justify-between gap-3"><div><p class="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-200">Ma’at équipe · Premium</p><h2 id="premium-access-title" class="mt-1 text-base font-semibold">Accès aux vues et documents d’équipe</h2></div><button type="button" class="secondary min-h-10 px-3 text-xs" [disabled]="loading()" (click)="load()">{{loading()?'Actualisation…':'Actualiser le statut'}}</button></div>
 <p *ngIf="loading()&&!status()" role="status" class="mt-3 text-sm">Vérification de votre accès…</p>
 <ng-container *ngIf="status() as current">
  <p *ngIf="current.trialActive" class="mt-3 text-sm leading-6">Votre essai de 30 jours est actif jusqu’au <strong>{{current.trialEndsAt | date:'d MMMM yyyy'}}</strong>. Les outils Premium d’équipe sont disponibles pendant cette période.</p>
  <p *ngIf="current.paidActive" class="mt-3 text-sm leading-6">Votre accès Premium est actif jusqu’au <strong>{{current.paidUntil | date:'d MMMM yyyy'}}</strong>.</p>
  <div *ngIf="!current.active&&current.pendingRequest" class="mt-3 rounded-xl bg-white/80 p-3 text-sm dark:bg-gray-900/60"><p class="font-semibold">Demande en attente</p><p class="mt-1 leading-6">Tarif demandé : {{current.requestedTariff}} · envoyée le {{current.requestCreatedAt | date:'dd/MM/yyyy'}}. L’administrateur vérifiera le paiement Mobile Money hors Ma’at avant toute activation.</p></div>
  <form *ngIf="!current.active&&!current.pendingRequest" class="mt-4 grid gap-3 rounded-xl bg-white/80 p-3 dark:bg-gray-900/60" (ngSubmit)="submit()">
   <p class="text-sm leading-6">Votre période d’essai est terminée. Indique le tarif convenu et, si disponible, la référence de transaction. Le paiement se fait hors plateforme ; une demande ne donne pas automatiquement accès au Premium.</p>
   <label class="grid gap-1 text-xs font-medium">Tarif demandé (nom ou code)<input appUiField name="requestedTariff" [(ngModel)]="requestedTariff" required maxlength="80" class="min-h-11 rounded-lg border bg-white p-2 text-sm dark:bg-gray-800" placeholder="Tarif équipe convenu" /></label>
   <label class="grid gap-1 text-xs font-medium">Référence Mobile Money (facultative)<input appUiField name="paymentReference" [(ngModel)]="paymentReference" maxlength="120" class="min-h-11 rounded-lg border bg-white p-2 text-sm dark:bg-gray-800" /></label>
   <label class="grid gap-1 text-xs font-medium">Précision pour l’administrateur (facultatif)<textarea appUiField name="requestNote" [(ngModel)]="requestNote" maxlength="1000" rows="2" class="rounded-lg border bg-white p-2 text-sm dark:bg-gray-800"></textarea></label>
   <div class="flex flex-wrap items-center justify-between gap-3"><p *ngIf="message()" role="alert" class="text-sm text-red-700 dark:text-red-300">{{message()}}</p><button type="submit" class="primary min-h-11" [disabled]="saving()||!requestedTariff.trim()">{{saving()?'Envoi…':'Demander l’accès Premium'}}</button></div>
  </form>
 </ng-container>
 <p *ngIf="!loading()&&!status()" role="alert" class="mt-3 text-sm text-red-700 dark:text-red-300">Statut Premium indisponible. Actualisez la page avant de continuer.</p>
</section>`})
export class PremiumAccessComponent {
 readonly auth=inject(AuthService);readonly status=signal<PremiumStatus|null>(null);readonly loading=signal(false);readonly saving=signal(false);readonly message=signal('');
 requestedTariff='';paymentReference='';requestNote='';
 @Output() activeChange=new EventEmitter<boolean>();
 constructor(){effect(()=>{const user=this.auth.user();const initializing=this.auth.initializing();if(initializing)return;this.status.set(null);this.loading.set(false);this.activeChange.emit(false);this.message.set('');this.requestedTariff='';this.paymentReference='';this.requestNote='';if(user)void this.load();});}
 async load(){const actor=this.auth.user()?.id;if(!actor){this.status.set(null);this.activeChange.emit(false);return;}this.loading.set(true);this.message.set('');try{const result=await this.auth.client.rpc('taskboard_premium_status');if(actor!==this.auth.user()?.id)return;if(result.error||!result.data?.trialStartedAt)throw new Error();this.status.set(result.data as PremiumStatus);this.activeChange.emit(!!result.data.active);}catch{if(actor===this.auth.user()?.id){this.status.set(null);this.activeChange.emit(false);}}finally{if(actor===this.auth.user()?.id)this.loading.set(false);}}
 async submit(){if(this.saving()||!this.requestedTariff.trim())return;this.saving.set(true);this.message.set('');try{const result=await this.auth.client.rpc('taskboard_request_premium_access',{requested_tariff:this.requestedTariff.trim(),payment_reference:this.paymentReference.trim()||null,request_note:this.requestNote.trim()||null});if(result.error)throw new Error();this.requestedTariff='';this.paymentReference='';this.requestNote='';await this.load();}catch{this.message.set('Demande non envoyée. Vérifie que l’essai est terminé et que tu n’as pas déjà une demande en attente.');}finally{this.saving.set(false);}}
}
