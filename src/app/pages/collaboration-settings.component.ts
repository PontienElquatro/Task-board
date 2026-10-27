import { Component, EventEmitter, Input, Output, OnChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Team, TeamService } from '../services/team.service';
import { AuthService } from '../services/auth.service';

export interface SharedProjectSettings {id:string;team_id:string;title:string;description?:string;archived_at?:string|null;settings_version?:number;access_mode?:'team'|'restricted';}
export interface ProjectParticipant {project_id:string;user_id:string;role:'member'|'viewer';}

@Component({selector:'app-team-settings',standalone:true,imports:[CommonModule,FormsModule],template:`
<details class="mt-4 rounded-xl border border-blue-200 bg-white p-4 dark:border-indigo-800 dark:bg-gray-900">
 <summary class="min-h-11 cursor-pointer py-2 font-semibold">Paramètres de l’équipe <span *ngIf="team.archived_at">· Close</span></summary>
 <p *ngIf="team.archived_at" class="my-3 text-sm">Travaux clos : les projets restent consultables, sans modification. Seul le propriétaire peut rouvrir l’équipe.</p>
 <p *ngIf="message" role="status" class="my-3 text-sm">{{message}}</p>
 <p *ngIf="!team.settings_version" class="my-3 text-sm">Cette fonctionnalité nécessite la mise à jour du serveur.</p>
 <form *ngIf="teams.canManage(team) && !team.archived_at" class="my-3 grid gap-3" (ngSubmit)="act('save')">
  <label class="grid gap-2 text-sm">Nom de l’équipe<input name="teamSettingsName" [(ngModel)]="name" required minlength="2" maxlength="100" [disabled]="busy" class="min-h-11 rounded-lg border bg-transparent p-3" /></label>
  <label class="grid gap-2 text-sm">Description<textarea name="teamSettingsDescription" [(ngModel)]="description" maxlength="2000" [disabled]="busy" class="rounded-lg border bg-transparent p-3"></textarea></label>
  <button class="primary min-h-11" [disabled]="busy || !team.settings_version || name.trim().length<2" type="submit">Enregistrer les paramètres</button>
 </form>
 <div *ngIf="owner()" class="my-3 grid gap-3">
  <button type="button" class="secondary min-h-11" [disabled]="busy || !team.settings_version" (click)="confirmation=team.archived_at?'reopen':'close'">{{team.archived_at?'Rouvrir l’équipe':'Clore les travaux de l’équipe'}}</button>
  <label class="grid gap-2 text-sm">Transférer la propriété à un membre<select [(ngModel)]="successor" [disabled]="busy" class="min-h-11 rounded-lg border bg-transparent p-3"><option value="">Choisir un membre</option><option *ngFor="let member of successors()" [value]="member.user_id">{{member.display_name}}</option></select></label>
  <button type="button" class="secondary min-h-11" [disabled]="busy || !successor || !team.settings_version" (click)="confirmation='transfer'">Préparer le transfert</button>
  <p class="text-xs">Pour quitter une équipe que vous possédez, transférez d’abord sa propriété. Aucun travail n’est supprimé.</p>
 </div>
 <button *ngIf="!owner()" type="button" class="secondary my-3 min-h-11" [disabled]="busy || !team.settings_version" (click)="confirmation='leave'">Quitter l’équipe</button>
 <section *ngIf="confirmation" class="mt-3 rounded-lg border border-blue-300 p-4" aria-label="Confirmation de l’action sur l’équipe">
  <p class="text-sm">{{confirmation==='leave'?'Vous perdrez l’accès aux projets de cette équipe. Vos travaux resteront dans l’équipe.':confirmation==='close'?'Tous les projets de cette équipe passeront en lecture seule, sans être supprimés.':confirmation==='transfer'?'Le membre choisi deviendra propriétaire. Vous deviendrez administrateur et perdrez le contrôle de la propriété.':'Les projets pourront être modifiés à nouveau, sauf ceux qui ont été clos séparément.'}}</p>
  <div class="mt-3 flex flex-wrap gap-3"><button type="button" class="primary min-h-11" [disabled]="busy" (click)="act(confirmation)">Confirmer</button><button type="button" class="secondary min-h-11" [disabled]="busy" (click)="confirmation=''">Annuler</button></div>
 </section>
</details>`})
export class TeamSettingsComponent implements OnChanges {
 @Input({required:true}) team!:Team;
 @Output() changed=new EventEmitter<void>();
 readonly teams=inject(TeamService);readonly auth=inject(AuthService);
 name='';description='';successor='';busy=false;message='';confirmation:''|'leave'|'close'|'reopen'|'transfer'='';
 ngOnChanges(){this.name=this.team.name;this.description=this.team.description??'';this.successor='';this.confirmation='';}
 owner(){return this.team.owner_id===this.auth.user()?.id;}
 successors(){return this.teams.members().filter(m=>m.team_id===this.team.id&&m.user_id!==this.team.owner_id);}
 async act(operation:'save'|'leave'|'close'|'reopen'|'transfer'){
  if(this.busy)return;this.busy=true;this.message='';const account=this.auth.user()?.id;
  try{await this.teams.settings(this.team,operation,operation==='save'?{new_name:this.name,new_description:this.description}:operation==='transfer'?{successor:this.successor}:{});
   if(account!==this.auth.user()?.id)return;this.confirmation='';this.message='Paramètres enregistrés.';this.changed.emit();
  }catch(e){this.message=e instanceof Error?e.message:'Action impossible.';}finally{this.busy=false;}
 }
}

@Component({selector:'app-project-settings',standalone:true,imports:[CommonModule,FormsModule],template:`
<details class="my-4 rounded-xl border border-blue-200 bg-white p-4 dark:border-indigo-800 dark:bg-gray-900" (toggle)="opened($event)">
 <summary class="min-h-11 cursor-pointer py-2 font-semibold">Paramètres du projet</summary>
 <p *ngIf="message" role="status" class="my-3 text-sm">{{message}}</p>
 <p *ngIf="!project.settings_version" class="my-3 text-sm">Cette fonctionnalité nécessite la mise à jour du serveur.</p>
 <p *ngIf="project.archived_at || team.archived_at" class="my-3 text-sm">Travaux clos : lecture seule, historique conservé.</p>
 <form class="my-3 grid gap-3" (ngSubmit)="act('save')">
  <label class="grid gap-2 text-sm">Nom du projet<input name="projectSettingsTitle" [(ngModel)]="title" required maxlength="100" [disabled]="locked()" class="min-h-11 rounded-lg border bg-transparent p-3" /></label>
  <label class="grid gap-2 text-sm">Description<textarea name="projectSettingsDescription" [(ngModel)]="description" maxlength="2000" [disabled]="locked()" class="rounded-lg border bg-transparent p-3"></textarea></label>
  <label class="grid gap-2 text-sm">Accès au projet<select name="projectAccess" [(ngModel)]="accessMode" [disabled]="locked()" class="min-h-11 rounded-lg border bg-transparent p-3"><option value="team">Toute l’équipe, selon les rôles de l’équipe</option><option value="restricted">Membres sélectionnés uniquement</option></select></label>
  <p class="text-xs">Le propriétaire et les administrateurs de l’équipe conservent l’accès. Un droit de projet ne peut pas dépasser le rôle dans l’équipe. Sélectionnez les membres ci-dessous avant de restreindre l’accès.</p>
  <button type="submit" class="primary min-h-11" [disabled]="locked() || !title.trim()">Enregistrer le projet</button>
 </form>
 <section class="my-4"><h3 class="font-semibold">Accès des membres sélectionnés</h3><p class="my-2 text-xs">Ces réglages s’appliquent quand l’accès est limité aux membres sélectionnés.</p>
  <div *ngFor="let member of eligibleMembers()" class="my-3 grid gap-2 sm:grid-cols-2"><label [for]="'project-member-'+project.id+'-'+member.user_id" class="self-center text-sm">{{member.display_name}}</label><select [id]="'project-member-'+project.id+'-'+member.user_id" [ngModel]="memberRole(member.user_id)" (ngModelChange)="setMember(member.user_id,$event)" [disabled]="locked() || loading" class="min-h-11 rounded-lg border bg-transparent p-2"><option value="">Aucun accès</option><option value="viewer">Lecture seule</option><option *ngIf="member.role==='member'" value="member">Lecture et modification</option></select></div>
 </section>
 <button type="button" class="secondary min-h-11" [disabled]="busy || !!team.archived_at || !project.settings_version" (click)="confirmation=project.archived_at?'reopen':'close'">{{project.archived_at?'Rouvrir le projet':'Clore le projet'}}</button>
 <section *ngIf="confirmation" class="mt-3 rounded-lg border border-blue-300 p-4" aria-label="Confirmation de clôture du projet"><p class="text-sm">{{confirmation==='close'?'Les tâches et sous-tâches passeront en lecture seule. Aucun travail ne sera supprimé.':'Les modifications seront à nouveau autorisées selon les droits de chaque membre.'}}</p><div class="mt-3 flex gap-3"><button type="button" class="primary min-h-11" [disabled]="busy" (click)="act(confirmation)">Confirmer</button><button type="button" class="secondary min-h-11" [disabled]="busy" (click)="confirmation=''">Annuler</button></div></section>
</details>`})
export class ProjectSettingsComponent implements OnChanges {
 @Input({required:true}) team!:Team;@Input({required:true}) project!:SharedProjectSettings;
 @Output() changed=new EventEmitter<void>();
 readonly teams=inject(TeamService);readonly auth=inject(AuthService);
 title='';description='';accessMode:'team'|'restricted'='team';busy=false;loading=false;message='';confirmation:''|'close'|'reopen'='';participants:ProjectParticipant[]=[];
 private loadedProject='';
 ngOnChanges(){this.title=this.project.title;this.description=this.project.description??'';this.accessMode=this.project.access_mode??'team';this.confirmation='';if(this.loadedProject!==this.project.id){this.loadedProject=this.project.id;this.participants=[];}}
 locked(){return this.busy||!!this.team.archived_at||!!this.project.archived_at||!this.project.settings_version;}
 eligibleMembers(){return this.teams.members().filter(m=>m.team_id===this.team.id&&!['owner','admin'].includes(m.role));}
 memberRole(id:string){return this.participants.find(m=>m.user_id===id)?.role??'';}
 async opened(event:Event){if((event.target as HTMLDetailsElement).open)await this.loadMembers();}
 async loadMembers(){this.loading=true;const account=this.auth.user()?.id,id=this.project.id;try{const r=await this.auth.client.from('taskboard_project_members').select('project_id,user_id,role').eq('project_id',id);if(r.error)throw new Error('Chargement des accès impossible.');if(account===this.auth.user()?.id&&id===this.project.id)this.participants=r.data??[];}catch(e){this.message=e instanceof Error?e.message:'Chargement impossible.';}finally{this.loading=false;}}
 async setMember(target:string,role:string){await this.act('member',{target,new_role:role||null});}
 async act(operation:'save'|'close'|'reopen'|'member',extra:Record<string,unknown>={}){
  if(this.busy)return;this.busy=true;this.message='';const account=this.auth.user()?.id;
  try{if(!this.project.settings_version)throw new Error('Mise à jour du serveur requise.');const r=await this.auth.client.rpc('taskboard_project_settings',{pid:this.project.id,operation,expected_version:this.project.settings_version,...(operation==='save'?{new_title:this.title,new_description:this.description,new_access_mode:this.accessMode}:extra)});if(r.error)throw new Error(r.error.code==='PT409'?'Les paramètres ont changé. Actualisez puis réessayez.':r.error.message);if(account!==this.auth.user()?.id)return;this.confirmation='';this.message='Paramètres enregistrés.';this.changed.emit();await this.loadMembers();}catch(e){this.message=e instanceof Error?e.message:'Action impossible.';}finally{this.busy=false;}
 }
}
