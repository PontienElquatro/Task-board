import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';

export interface AdminAccess {
  isPrincipal:boolean; permissions:string[]; fresh:boolean; version:number;
  pendingTransferTo?:string|null; transferExpiresAt?:string|null; canAcceptTransfer?:boolean;
}
interface Member {id:string;email:string;permissions:string[];version:number;principal:boolean;}

@Component({selector:'app-admin-access',standalone:true,imports:[CommonModule,FormsModule],template:`
<section class="rounded-2xl border border-blue-100 bg-white p-5 dark:border-indigo-900 dark:bg-gray-900">
  <h2 class="text-xl font-semibold">Rôles et accès administrateurs</h2>
  <p class="mt-2 text-sm">Seul l’administrateur principal nomme les administrateurs et définit leurs droits. Les changements sont journalisés.</p>
  <p *ngIf="error()" role="alert" class="mt-4 rounded-xl bg-red-50 p-3 text-red-800 dark:bg-red-950 dark:text-red-200">{{error()}}</p>
  <p *ngIf="notice()" role="status" class="mt-4 rounded-xl bg-blue-50 p-3 dark:bg-blue-950">{{notice()}}</p>
  <form class="mt-5 flex flex-wrap items-end gap-3" (ngSubmit)="reauthenticate()">
    <label class="grid gap-2 text-sm">Confirmer votre connexion (mot de passe actuel)
      <input class="min-h-11 rounded-xl border bg-transparent p-3" type="password" name="password" autocomplete="current-password" [(ngModel)]="password" required />
    </label>
    <button class="secondary min-h-11" [disabled]="busy()||!password">Vérifier ma connexion</button>
  </form>
  <p class="mt-2 text-xs">Une connexion récente de moins de 10 minutes est requise pour modifier les accès. Le mot de passe est envoyé uniquement au service d’authentification.</p>
  <ng-container *ngIf="access.isPrincipal">
    <button class="secondary mt-5 min-h-11" [disabled]="busy()" (click)="load()">Actualiser les administrateurs</button>
    <ul class="mt-4 grid gap-3"><li *ngFor="let member of members()" class="rounded-xl border p-3">
      <p class="break-all font-semibold">{{member.email}} · {{member.principal?'Principal':'Délégué'}}</p>
      <p class="mt-1 break-words text-xs">{{permissionLabels(member.permissions)}}</p>
      <button *ngIf="!member.principal" class="secondary mt-2 min-h-11" [disabled]="busy()" (click)="select(member.id)">Gérer cet accès</button>
    </li></ul>
    <form class="mt-6 grid gap-4" (ngSubmit)="change('grant')">
      <label class="grid gap-2 text-sm">Compte confirmé à nommer ou modifier
        <select name="target" class="min-h-11 rounded-xl border bg-transparent p-3" [(ngModel)]="target" (ngModelChange)="select($event)" required>
          <option value="">Choisir un compte</option><option *ngFor="let user of eligibleUsers()" [value]="user.id">{{user.email}}</option>
        </select>
      </label>
      <fieldset class="grid gap-2 sm:grid-cols-2"><legend class="mb-2 font-semibold">Autorisations accordées</legend>
        <label *ngFor="let scope of scopes" class="flex min-h-11 items-center gap-3"><input type="checkbox" [name]="scope.id" [checked]="permissions.includes(scope.id)" (change)="toggle(scope.id)" />{{scope.label}}</label>
      </fieldset>
      <label class="grid gap-2 text-sm">Motif du changement (10 à 500 caractères)<textarea name="reason" class="rounded-xl border bg-transparent p-3" [(ngModel)]="reason" minlength="10" maxlength="500" required></textarea></label>
      <label class="flex min-h-11 items-center gap-3"><input type="checkbox" name="confirm" [(ngModel)]="confirmed" />Je confirme ce changement d’accès.</label>
      <div class="flex flex-wrap gap-3"><button class="primary min-h-11" [disabled]="!canChange()||!permissions.length">Enregistrer les droits</button>
        <button type="button" class="secondary min-h-11" [disabled]="!canChange()||!selectedMember()" (click)="change('revoke')">Révoquer cet accès</button>
        <button type="button" class="secondary min-h-11" [disabled]="!canChange()||!selectedMember()" (click)="change('transfer_request')">Proposer le transfert du rôle principal</button></div>
    </form>
    <p class="mt-4 text-sm">Le transfert n’est effectif qu’après acceptation par le successeur sous 24 heures. Vous restez principal jusque-là.</p>
    <button *ngIf="access.pendingTransferTo" class="secondary mt-3 min-h-11" [disabled]="busy()||reason.trim().length<10" (click)="change('transfer_cancel')">Annuler le transfert en attente</button>
    <h3 class="mt-6 font-semibold">Journal des accès · 50 derniers changements</h3>
    <ul class="mt-3 grid gap-3"><li *ngFor="let event of events()" class="rounded-xl border p-3 text-sm"><p>{{event.created_at | date:'dd/MM/yyyy HH:mm'}} · {{event.action}}</p><p class="mt-1 break-all">Compte : {{event.target_id || '—'}}</p><p class="mt-1 break-words">{{event.reason}}</p></li></ul>
    <p *ngIf="!events().length" class="mt-3 text-sm">Aucun changement d’accès enregistré.</p>
  </ng-container>
  <div *ngIf="access.canAcceptTransfer" class="mt-6 rounded-xl border p-4">
    <h3 class="font-semibold">Transfert du rôle principal proposé</h3>
    <p class="mt-2">Expire le {{access.transferExpiresAt | date:'dd/MM/yyyy HH:mm'}}.</p>
    <label class="mt-3 grid gap-2">Motif de l’acceptation<textarea class="rounded-xl border bg-transparent p-3" [(ngModel)]="reason" maxlength="500"></textarea></label>
    <label class="mt-3 flex min-h-11 items-center gap-3"><input type="checkbox" [(ngModel)]="confirmed" />J’accepte la responsabilité d’administrateur principal.</label>
    <button class="primary mt-3 min-h-11" [disabled]="busy()||!confirmed||reason.trim().length<10" (click)="change('transfer_accept')">Accepter le transfert</button>
  </div>
</section>`})
export class AdminAccessComponent implements OnInit {
  @Input({required:true}) access!:AdminAccess;
  @Input() users:{id:string;email:string;confirmed:boolean;suspended?:boolean}[]=[];
  private readonly auth=inject(AuthService);
  readonly members=signal<Member[]>([]);readonly busy=signal(false);readonly error=signal('');readonly notice=signal('');
  readonly events=signal<{created_at:string;action:string;target_id:string|null;reason:string}[]>([]);
  password='';target='';reason='';confirmed=false;permissions=['users_read'];
  readonly scopes=[{id:'overview',label:'Vue d’ensemble'},{id:'users_read',label:'Consulter les utilisateurs'},{id:'users_manage',label:'Suspendre ou réactiver les comptes'},{id:'teams_read',label:'Superviser les équipes'},{id:'audit_read',label:'Consulter le journal'},{id:'settings_read',label:'Consulter les paramètres plateforme'},{id:'settings_manage',label:'Modifier les paramètres plateforme'}];
  ngOnInit(){if(this.access.isPrincipal)void this.load();}
  eligibleUsers(){return this.users.filter(u=>u.confirmed&&!u.suspended&&!this.members().find(m=>m.id===u.id)?.principal);}
  permissionLabels(values:string[]){return this.scopes.filter(s=>values.includes(s.id)).map(s=>s.label).join(' · ');}
  selectedMember(){return this.members().find(m=>m.id===this.target&&!m.principal);}
  select(id:string){this.target=id;this.permissions=[...(this.selectedMember()?.permissions??['users_read'])];this.confirmed=false;}
  toggle(scope:string){this.permissions=this.permissions.includes(scope)?this.permissions.filter(p=>p!==scope):[...this.permissions,scope];}
  canChange(){return !this.busy()&&!!this.target&&this.confirmed&&this.reason.trim().length>=10&&this.reason.trim().length<=500;}
  async load(){
    this.busy.set(true);this.error.set('');
    try{const result=await this.auth.client.functions.invoke('taskboard-admin',{body:{action:'access_directory'}});if(result.error||!Array.isArray(result.data?.members))throw new Error();this.members.set(result.data.members);this.events.set(result.data.events??[]);}
    catch{this.error.set('Liste des administrateurs indisponible. Réessayez.');}finally{this.busy.set(false);}
  }
  async reauthenticate(){
    const email=this.auth.user()?.email;if(!email||!this.password||this.busy())return;
    this.busy.set(true);this.error.set('');
    try{const result=await this.auth.client.auth.signInWithPassword({email,password:this.password});if(result.error)throw new Error();this.notice.set('Connexion vérifiée. Vous pouvez confirmer le changement.');}
    catch{this.error.set('Connexion non vérifiée. Vérifiez votre mot de passe ou reconnectez-vous.');}
    finally{this.password='';this.busy.set(false);}
  }
  async change(operation:string){
    if(this.busy()||!this.confirmed||this.reason.trim().length<10)return;
    const actor=this.auth.user()?.id;this.busy.set(true);this.error.set('');this.notice.set('');
    try{
      const transfer=operation.startsWith('transfer_');
      const result=await this.auth.client.functions.invoke('taskboard-admin',{body:{action:'access_'+operation,
        ...(this.target?{targetId:this.target}:{}),...(operation==='grant'?{permissions:this.permissions}:{}),
        expectedVersion:transfer?this.access.version:this.selectedMember()?.version??null,reason:this.reason.trim()}});
      if(actor!==this.auth.user()?.id)return;
      if(result.error||!result.data?.success)throw new Error();
      this.confirmed=false;this.reason='';
      const identity=await this.auth.client.functions.invoke('taskboard-admin',{body:{action:'check_access'}});
      if(identity.error||!identity.data?.isAdmin)throw new Error();this.access=identity.data;
      if(this.access.isPrincipal)await this.load();
      this.notice.set('Changement enregistré et journalisé. Actualisez la console pour appliquer la navigation à votre rôle.');
    }catch{this.error.set('Changement refusé. Vérifiez votre connexion récente, vos droits et actualisez la liste avant de réessayer.');}
    finally{this.busy.set(false);}
  }
}
