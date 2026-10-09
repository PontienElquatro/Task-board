import { Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({standalone:true,selector:'app-session-security',imports:[CommonModule],template:`
<article class="rounded-2xl border border-blue-100 bg-white p-6 dark:border-indigo-900 dark:bg-gray-900" [attr.aria-busy]="busy()">
 <h2 class="text-lg font-semibold">Sessions de connexion</h2>
 <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">Contrôlez les connexions à votre compte sans supprimer vos projets ni vos tâches.</p>
 <div *ngIf="auth.user(); else disconnected" class="mt-5 rounded-xl bg-blue-50 p-4 dark:bg-blue-950">
  <h3 class="font-semibold">Session actuelle · cet onglet</h3>
  <p class="mt-1 break-words text-sm">{{auth.user()?.email}}</p>
  <p class="mt-2 text-sm leading-6">Ma’at conserve votre connexion dans cet onglet. Une autre connexion au même compte peut constituer une session distincte, même sur cet ordinateur.</p>
 </div>
 <ng-template #disconnected><p class="mt-4 text-sm">Connectez-vous pour gérer les sessions de votre compte.</p></ng-template>
 <p class="mt-4 text-sm leading-6 text-gray-600 dark:text-gray-300">La liste détaillée des appareils n’est pas disponible ici. Cette action concerne toutes les autres sessions du même compte, pas celles des autres membres.</p>
 <button type="button" class="secondary mt-5 min-h-11 disabled:opacity-50" [disabled]="!auth.user() || busy()" (click)="confirm.set(true); success.set('')">Déconnecter les autres sessions</button>
 <section *ngIf="confirm()" aria-label="Confirmation de déconnexion des autres sessions" class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
  <h3 class="font-semibold">Conserver uniquement cette session ?</h3>
  <p class="mt-2 text-sm leading-6">Les autres connexions devront se reconnecter. Leurs jetons d’accès déjà délivrés peuvent rester utilisables jusqu’à leur expiration : la coupure n’est pas forcément immédiate. Des modifications non synchronisées dans ces sessions risquent de ne plus pouvoir être sauvegardées.</p>
  <div class="mt-4 flex flex-wrap gap-3"><button type="button" class="primary min-h-11 disabled:opacity-50" [disabled]="busy()" (click)="revokeOthers()">{{busy() ? 'Déconnexion…' : 'Confirmer la déconnexion'}}</button><button type="button" class="secondary min-h-11" [disabled]="busy()" (click)="confirm.set(false); error.set('')">Annuler</button></div>
 </section>
 <p *ngIf="error()" role="alert" class="mt-4 text-sm text-red-700 dark:text-red-300">{{error()}}</p>
 <p *ngIf="success()" role="status" class="mt-4 text-sm text-emerald-700 dark:text-emerald-300">{{success()}}</p>
 <p class="mt-5 text-sm leading-6 text-gray-600 dark:text-gray-300">Pour quitter cette session, utilisez la déconnexion dans l’en-tête : Ma’at vérifie d’abord la sauvegarde cloud. Si vous suspectez un accès non autorisé, changez également votre mot de passe dans Sécurité.</p>
</article>`})
export class SessionSecurityComponent {
 readonly auth=inject(AuthService);
 readonly busy=signal(false);readonly confirm=signal(false);readonly error=signal('');readonly success=signal('');
 private epoch=0;private accountId:string|undefined;
 constructor(){inject(DestroyRef).onDestroy(()=>{this.epoch++;});effect(()=>{const id=this.auth.user()?.id;if(id===this.accountId)return;this.accountId=id;untracked(()=>{this.epoch++;this.busy.set(false);this.confirm.set(false);this.error.set('');this.success.set('');});});}
 async revokeOthers(){
  const id=this.auth.user()?.id;
  if(!id||!this.confirm()||this.busy())return;
  const epoch=this.epoch;this.busy.set(true);this.error.set('');this.success.set('');
  try{
   const {data,error}=await this.auth.client.auth.getUser();
   if(error||data.user?.id!==id)throw new Error('invalid session');
   if(epoch!==this.epoch||this.auth.user()?.id!==id)return;
   const result=await this.auth.client.auth.signOut({scope:'others'});
   if(result.error)throw result.error;
   if(epoch!==this.epoch||this.auth.user()?.id!==id)return;
   this.confirm.set(false);
   this.success.set('Renouvellement des autres sessions révoqué. Cette session est conservée ; les autres accès cesseront au plus tard à l’expiration de leurs jetons.');
  }catch{if(epoch===this.epoch&&this.auth.user()?.id===id)this.error.set('Déconnexion des autres sessions non confirmée. Vérifiez votre connexion et réessayez.');}
  finally{if(epoch===this.epoch)this.busy.set(false);}
 }
}
