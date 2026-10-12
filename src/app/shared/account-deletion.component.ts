import { Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';

interface DeletionState {enabled:boolean;status:'pending'|'cancelled'|'processing'|null;deleteAfter:string|null;requestedAt:string|null;}
@Component({standalone:true,selector:'app-account-deletion',imports:[CommonModule,FormsModule],template:`
<article class="rounded-2xl border border-red-200 bg-white p-6 dark:border-red-900 dark:bg-gray-900" [attr.aria-busy]="busy()">
 <h2 class="text-lg font-semibold">Suppression du compte</h2>
 <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">Vous disposez de 30 jours pour annuler une demande. Votre compte reste accessible pendant ce délai.</p>
 <p *ngIf="!auth.user()" class="mt-4 text-sm">Connectez-vous pour gérer votre compte.</p>
 <p *ngIf="loading()" role="status" class="mt-4 text-sm">Vérification de l’état du compte…</p>
 <p *ngIf="error()" role="alert" class="mt-4 text-sm text-red-700 dark:text-red-300">{{error()}}</p>
 <button *ngIf="auth.user() && !state() && !loading()" type="button" class="secondary mt-3 min-h-11" (click)="load()">Réessayer</button>
 <ng-container *ngIf="state() as current">
  <section *ngIf="current.status==='pending'" class="mt-4 rounded-xl bg-amber-50 p-4 dark:bg-amber-950">
   <h3 class="font-semibold">Suppression demandée</h3>
   <p class="mt-2 text-sm leading-6">Vous pouvez annuler avant le {{current.deleteAfter | date:'dd/MM/yyyy à HH:mm'}} (heure locale). Le traitement définitif intervient après cette échéance.</p>
   <button class="secondary mt-4 min-h-11" type="button" [disabled]="busy()" (click)="perform('cancel')">{{busy() ? 'Traitement…' : 'Annuler la suppression de mon compte'}}</button>
  </section>
  <p *ngIf="current.status==='processing'" role="status" class="mt-4 text-sm">La suppression est en traitement ; elle ne peut plus être annulée ici.</p>
  <ng-container *ngIf="current.status!=='pending' && current.status!=='processing'">
   <p *ngIf="!current.enabled" class="mt-4 rounded-xl bg-gray-50 p-4 text-sm leading-6 dark:bg-gray-800">La suppression différée n’est pas encore disponible. Elle sera activée après validation du traitement automatique. Aucune suppression n’est programmée.</p>
   <button type="button" class="secondary mt-4 min-h-11 text-red-700 disabled:opacity-50 dark:text-red-300" [disabled]="!current.enabled || busy()" (click)="confirm.set(true)">Demander la suppression de mon compte</button>
  </ng-container>
 </ng-container>
 <section *ngIf="confirm()" class="mt-4 grid gap-4 rounded-xl bg-red-50 p-4 dark:bg-red-950" aria-label="Confirmation de demande de suppression">
  <p class="text-sm leading-6">À l’issue du délai, votre compte, votre espace personnel et votre photo seront supprimés définitivement. Vos équipes doivent être transférées avant la demande. Les comptes administrateurs sont protégés. Les sauvegardes que vous avez exportées sur votre appareil ne sont pas effacées.</p>
  <p class="text-sm">Exportez vos données dans Sauvegardes avant de continuer.</p>
  <label class="flex items-start gap-3 text-sm"><input type="checkbox" class="mt-1 h-5 w-5" [(ngModel)]="acknowledged" [disabled]="busy()" />Je comprends les conséquences et j’ai conservé les données dont j’ai besoin.</label>
  <label class="grid gap-2 text-sm">Saisissez SUPPRIMER pour confirmer<input class="min-h-11 rounded-xl border border-red-200 bg-white p-3 dark:bg-gray-900" [(ngModel)]="confirmationText" [disabled]="busy()" autocomplete="off" /></label>
  <div class="flex flex-wrap gap-3"><button type="button" class="min-h-11 rounded-xl bg-red-700 px-4 text-sm font-semibold text-white disabled:opacity-50" [disabled]="busy() || !acknowledged || confirmationText!=='SUPPRIMER'" (click)="perform('request')">{{busy() ? 'Traitement…' : 'Confirmer la demande à 30 jours'}}</button><button type="button" class="secondary min-h-11" [disabled]="busy()" (click)="closeConfirmation()">Conserver mon compte</button></div>
 </section>
 <p *ngIf="success()" role="status" class="mt-4 text-sm text-emerald-700 dark:text-emerald-300">{{success()}}</p>
</article>`})
export class AccountDeletionComponent {
 readonly auth=inject(AuthService);readonly state=signal<DeletionState|null>(null);
 readonly loading=signal(false);readonly busy=signal(false);readonly confirm=signal(false);readonly error=signal('');readonly success=signal('');
 acknowledged=false;confirmationText='';private epoch=0;private accountId:string|undefined;
 constructor(){inject(DestroyRef).onDestroy(()=>{this.epoch++;});effect(()=>{const id=this.auth.user()?.id;if(id===this.accountId)return;this.accountId=id;untracked(()=>{this.epoch++;this.state.set(null);this.loading.set(false);this.busy.set(false);this.error.set('');this.success.set('');this.closeConfirmation();if(id)void this.load();});});}
 closeConfirmation(){this.confirm.set(false);this.acknowledged=false;this.confirmationText='';}
 async load(){
  const id=this.auth.user()?.id;if(!id||this.loading()||this.busy())return;
  const epoch=this.epoch;this.loading.set(true);this.error.set('');
  try{const {data,error}=await this.auth.client.rpc('taskboard_manage_account_deletion',{operation:'status'});if(error||!data)throw error;
   if(epoch===this.epoch&&this.auth.user()?.id===id)this.state.set(data as DeletionState);
  }catch{if(epoch===this.epoch)this.error.set('État du compte indisponible. Réessayez.');}
  finally{if(epoch===this.epoch)this.loading.set(false);}
 }
 async perform(operation:'request'|'cancel'){
  const id=this.auth.user()?.id;if(!id||this.busy()||!this.state())return;
  if(operation==='request'&&(!this.state()!.enabled||!this.confirm()||!this.acknowledged||this.confirmationText!=='SUPPRIMER'))return;
  if(operation==='cancel'&&this.state()!.status!=='pending')return;
  const epoch=this.epoch;this.busy.set(true);this.error.set('');this.success.set('');
  try{
   const identity=await this.auth.client.auth.getUser();
   if(epoch!==this.epoch||this.auth.user()?.id!==id)return;
   if(identity.error||identity.data.user?.id!==id)throw new Error('Identité non confirmée');
   const {data,error}=await this.auth.client.rpc('taskboard_manage_account_deletion',{operation});if(error||!data)throw error;
   if(epoch!==this.epoch||this.auth.user()?.id!==id)return;
   this.state.set(data as DeletionState);this.closeConfirmation();
   this.success.set(operation==='cancel'?'Suppression annulée. Votre compte est conservé.':'Demande enregistrée. Vous disposez de 30 jours pour annuler.');
  }catch{if(epoch===this.epoch)this.error.set('Action non confirmée. Vérifiez que vos équipes sont transférées et que le délai d’annulation n’est pas expiré, puis réessayez.');}
  finally{if(epoch===this.epoch)this.busy.set(false);}
 }
}
