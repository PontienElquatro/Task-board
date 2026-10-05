import { Component, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageShellComponent } from './page-shell.component';
import { AuthService } from '../services/auth.service';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CardAppearanceService } from '../services/card-appearance.service';
import { TeamService } from '../services/team.service';

interface Subtask {id:string;task_id:string;team_id:string;title:string;completed:boolean;assignee_id:string|null;}
interface Project {id:string;team_id:string;title:string;}
interface SharedTask {id:string;project_id:string;team_id:string;title:string;description:string;status:string;assignee_id:string|null;}

@Component({standalone:true,imports:[CommonModule,FormsModule,PageShellComponent],template:`
<app-page-shell title="Projets d’équipe" description="Un tableau partagé pour chaque projet, avec des responsables clairement identifiés.">
 <p *ngIf="message()" role="status" class="mb-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200">{{message()}}</p>
 <p *ngIf="!auth.user() && !auth.initializing()">Connectez-vous pour retrouver vos projets d’équipe.</p>
 <div *ngIf="auth.user()" class="grid gap-4">
  <label class="grid gap-2 text-sm">Équipe<select [ngModel]="teamId" (ngModelChange)="selectTeam($event)" class="min-h-11 rounded-lg border border-gray-300 bg-white p-2 dark:bg-gray-800"><option value="">Choisir une équipe</option><option *ngFor="let team of teams.teams()" [value]="team.id">{{team.name}} · {{teams.roleLabel(teams.role(team))}}</option></select></label>
  <form *ngIf="canManage()" (ngSubmit)="createProject()" class="flex flex-wrap gap-2"><label class="grid flex-1 gap-2 text-sm">Nouveau projet<input name="projectTitle" [(ngModel)]="projectTitle" required maxlength="100" class="min-h-11 rounded-lg border border-gray-300 bg-white p-2 dark:bg-gray-800" /></label><button class="primary min-h-11 self-end" [disabled]="busy()" type="submit">Créer le projet</button></form>
  <label *ngIf="teamId" class="grid gap-2 text-sm">Projet<select [ngModel]="projectId" (ngModelChange)="selectProject($event)" class="min-h-11 rounded-lg border border-gray-300 bg-white p-2 dark:bg-gray-800"><option value="">Choisir un projet</option><option *ngFor="let project of projects()" [value]="project.id">{{project.title}}</option></select></label>
  <p *ngIf="teamId && !projects().length" class="text-sm text-gray-500 dark:text-gray-400">Aucun projet partagé dans cette équipe.</p>
  <ng-container *ngIf="projectId"><section class="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950" aria-label="Avancement du projet"><h2 class="font-semibold">Avancement · {{progress()}} %</h2><p class="mt-2 text-sm">{{doneCount()}} / {{tasks().length}} tâches terminées · {{completedSubtasks()}} / {{subtasks().length}} sous-tâches terminées</p><progress class="mt-3 h-2 w-full accent-blue-600" [value]="progress()" max="100" aria-label="Pourcentage de tâches terminées"></progress></section>
   <div class="flex flex-wrap items-end gap-4"><label class="grid gap-2 text-sm">Responsable<select [(ngModel)]="assigneeFilter" class="min-h-11 rounded-lg border border-gray-300 bg-white p-2 dark:bg-gray-800"><option value="">Tous les membres</option><option value="none">Non assignées</option><option *ngFor="let member of teamMembers()" [value]="member.user_id">{{member.display_name}}</option></select></label><button class="secondary min-h-11" [disabled]="busy()" (click)="refreshTasks()">Actualiser</button></div>
   <p *ngIf="!canEdit()" class="text-sm text-gray-500 dark:text-gray-400">Vous pouvez mettre à jour le travail qui vous est assigné.</p>
   <form *ngIf="canEdit()" (ngSubmit)="saveTask()" class="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
    <h2 class="font-semibold">Nouvelle tâche</h2>
    <label class="grid gap-2 text-sm">Titre<input name="title" [(ngModel)]="title" required maxlength="200" class="min-h-11 rounded-lg border border-gray-300 bg-white p-2 dark:bg-gray-900" /></label>
    <label class="grid gap-2 text-sm">Description<textarea name="description" [(ngModel)]="description" maxlength="10000" class="rounded-lg border border-gray-300 bg-white p-2 dark:bg-gray-900"></textarea></label>
    <div class="flex flex-wrap gap-4"><label class="grid gap-2 text-sm">Statut<select name="status" [(ngModel)]="status" class="min-h-11 rounded-lg border border-gray-300 bg-white p-2 dark:bg-gray-900"><option value="todo">À faire</option><option value="in-progress">En cours</option><option value="done">Terminé</option></select></label>
    <label class="grid gap-2 text-sm">Assigner à<select name="assignee" [(ngModel)]="assignee" class="min-h-11 rounded-lg border border-gray-300 bg-white p-2 dark:bg-gray-900"><option value="">Non assignée</option><option *ngFor="let member of teamMembers()" [value]="member.user_id">{{member.display_name}}</option></select></label></div>
    <div class="flex gap-2"><button class="primary min-h-11" [disabled]="busy()" type="submit">Enregistrer</button></div>
   </form>
   <section class="grid items-start gap-4 lg:grid-cols-3" aria-label="Tableau partagé">
    <div *ngFor="let column of columns" class="min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
     <header class="mb-4 flex items-center justify-between"><h2 class="text-sm font-semibold">{{column.label}}</h2><span class="rounded-full bg-gray-200 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">{{columnTasks(column.id).length}}</span></header>
     <article [id]="'task-'+task.id" *ngFor="let task of columnTasks(column.id); trackBy: trackTask" [ngClass]="appearance.classes(task.status)" class="group mb-4 rounded-xl border border-gray-200 p-2 shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-gray-700">
      <div class="flex items-start gap-2">
       <label class="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950" [attr.aria-label]="'Terminer ou rouvrir : ' + task.title"><input type="checkbox" class="h-4 w-4 accent-blue-600" [checked]="task.status === 'done'" [disabled]="busy() || !canWork(task.assignee_id)" (change)="progressWork(task.id,false,task.status === 'done' ? 'in-progress' : 'done')" /></label>
       <h3 class="min-w-0 flex-1 break-words py-2 text-sm font-semibold text-gray-900 dark:text-gray-100" [class.line-through]="task.status === 'done'">{{task.title}}</h3>
      </div>
      <div *ngIf="task.assignee_id || taskSubtasks(task.id).length" class="flex flex-wrap items-center gap-2 pl-12 text-xs text-gray-500 dark:text-gray-400">
       <span *ngIf="taskSubtasks(task.id).length">☑ {{subDone(task.id)}}/{{taskSubtasks(task.id).length}}</span>
       <span *ngIf="task.assignee_id" class="max-w-32 truncate" [title]="memberName(task.assignee_id)">{{memberName(task.assignee_id)}}</span>
      </div>
      <details class="mt-2 border-t border-gray-100 dark:border-gray-700">
       <summary class="flex min-h-11 cursor-pointer items-center justify-between rounded-lg px-2 text-xs font-medium text-gray-600 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-300 dark:hover:bg-gray-900"><span>Ouvrir les détails</span><span aria-hidden="true">⌄</span></summary>
       <div class="grid gap-4 pt-2">
        <ng-container *ngIf="canEdit(); else fullDescription">
         <label class="grid gap-2 text-xs">Titre<input [ngModel]="cardDraft(task).title" (ngModelChange)="setCardDraft(task,'title',$event)" maxlength="200" [disabled]="busy()" class="min-h-11 w-full rounded-lg border border-gray-300 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-900" /></label>
         <label class="grid gap-2 text-xs">Description<textarea [ngModel]="cardDraft(task).description" (ngModelChange)="setCardDraft(task,'description',$event)" maxlength="10000" [disabled]="busy()" rows="3" class="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-900"></textarea></label>
         <div *ngIf="cardDirty(task)" class="flex flex-wrap gap-2"><button class="primary min-h-11" [disabled]="busy() || !cardDraft(task).title.trim()" (click)="saveCard(task)">Enregistrer</button><button class="secondary min-h-11" [disabled]="busy()" (click)="discardCard(task.id)">Annuler</button></div>
         <label class="grid gap-2 text-xs">Responsable<select [ngModel]="task.assignee_id || ''" (ngModelChange)="assignTask(task.id,$event)" [disabled]="busy()" class="min-h-11 rounded-lg border border-gray-300 bg-white p-2 dark:bg-gray-900"><option value="">Non assignée</option><option *ngFor="let member of teamMembers()" [value]="member.user_id">{{member.display_name}}</option></select></label>
        </ng-container>
        <ng-template #fullDescription><p *ngIf="task.description" class="whitespace-pre-wrap break-words text-sm text-gray-600 dark:text-gray-300">{{task.description}}</p></ng-template>
        <label *ngIf="canWork(task.assignee_id)" class="grid gap-2 text-xs">Statut<select [ngModel]="task.status" (ngModelChange)="progressWork(task.id,false,$event)" [disabled]="busy()" class="min-h-11 rounded-lg border border-gray-300 bg-white p-2 dark:bg-gray-900"><option value="todo">À faire</option><option value="in-progress">En cours</option><option value="done">Terminé</option></select></label>
        <div *ngFor="let sub of taskSubtasks(task.id); trackBy: trackTask" class="border-t border-gray-100 pt-2 dark:border-gray-700">
         <label class="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" class="h-4 w-4 shrink-0 accent-blue-600" [ngModel]="sub.completed" (ngModelChange)="progressWork(sub.id,true,$event?'done':'todo')" [disabled]="busy() || !canWork(sub.assignee_id)" /><span class="break-words" [class.line-through]="sub.completed" [class.text-gray-400]="sub.completed">{{sub.title}}</span></label>
         <label *ngIf="canEdit(); else subMember" class="grid gap-2 text-xs">Responsable<select [ngModel]="sub.assignee_id || ''" (ngModelChange)="assignSubtask(sub.id,$event)" [disabled]="busy()" class="min-h-11 rounded-lg border border-gray-300 bg-white p-2 dark:bg-gray-900"><option value="">Non assignée</option><option *ngFor="let member of teamMembers()" [value]="member.user_id">{{member.display_name}}</option></select></label>
         <ng-template #subMember><p class="text-xs text-gray-500 dark:text-gray-400">{{memberName(sub.assignee_id)}}</p></ng-template>
        </div>
        <details *ngIf="canEdit()" class="border-t border-gray-100 dark:border-gray-700">
         <summary class="flex min-h-11 cursor-pointer items-center text-xs font-medium text-blue-700 dark:text-blue-300">+ Ajouter une sous-tâche</summary>
         <form class="grid gap-2" (ngSubmit)="addSubtask(task.id)">
          <label class="grid gap-2 text-xs">Titre<input [name]="'sub-'+task.id" [(ngModel)]="subTitles[task.id]" required maxlength="200" class="min-h-11 rounded-lg border border-gray-300 bg-white p-2 dark:bg-gray-900" /></label>
          <label class="grid gap-2 text-xs">Responsable<select [name]="'sub-assignee-'+task.id" [ngModel]="subAssignees[task.id] || ''" (ngModelChange)="subAssignees[task.id]=$event" class="min-h-11 rounded-lg border border-gray-300 bg-white p-2 dark:bg-gray-900"><option value="">Non assignée</option><option *ngFor="let member of teamMembers()" [value]="member.user_id">{{member.display_name}}</option></select></label>
          <button class="secondary min-h-11" [disabled]="busy()" type="submit">Ajouter</button>
         </form>
        </details>
       </div>
      </details>
     </article>
     <p *ngIf="!columnTasks(column.id).length" class="rounded-lg py-4 text-center text-xs text-gray-500 dark:text-gray-400">Aucune tâche dans cette colonne</p>
    </div>
   </section>
  </ng-container>
 </div>
</app-page-shell>`})
export class SharedProjectsComponent {
 readonly appearance=inject(CardAppearanceService);readonly auth=inject(AuthService);readonly teams=inject(TeamService);
 private readonly route=inject(ActivatedRoute);
 private readonly routeParams=toSignal(this.route.queryParamMap);
 readonly subtasks=signal<Subtask[]>([]);subTitles:Record<string,string>={};subAssignees:Record<string,string>={};
 readonly projects=signal<Project[]>([]);readonly tasks=signal<SharedTask[]>([]);readonly message=signal('');readonly busy=signal(false);
 teamId='';projectId='';projectTitle='';assigneeFilter='';title='';description='';status='todo';assignee='';
 readonly columns=[{id:'todo',label:'À faire'},{id:'in-progress',label:'En cours'},{id:'done',label:'Terminé'}];
 private revision=0;
 constructor(){effect(()=>{this.routeParams();const user=this.auth.user();if(!this.auth.initializing())untracked(()=>{this.revision++;this.teamId='';this.projectId='';this.projects.set([]);this.tasks.set([]);this.subtasks.set([]);this.cardDrafts={};this.clearDraft();if(user)void this.run(async()=>{await this.teams.load();const tid=this.route.snapshot.queryParamMap.get('team');if(tid&&this.teams.teams().some(t=>t.id===tid)){this.teamId=tid;const r=await this.auth.client.from('taskboard_shared_projects').select('id,team_id,title').eq('team_id',tid);if(r.error)throw new Error(r.error.message);this.projects.set(r.data??[]);const pid=this.route.snapshot.queryParamMap.get('project');if(pid&&this.projects().some(p=>p.id===pid)){this.projectId=pid;await this.readTasks();}}});});});}
 trackTask(_index:number,task:{id:string}){return task.id;}
 initials(id:string|null){return id?this.memberName(id).split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase():'—';}
 currentTeam(){return this.teams.teams().find(t=>t.id===this.teamId);}
 canManage(){const t=this.currentTeam();return !!t&&this.teams.canManage(t);}
 canEdit(){const t=this.currentTeam();return !!t&&['owner','admin','member'].includes(this.teams.role(t)??'');}
 teamMembers(){return this.teams.members().filter(m=>m.team_id===this.teamId);}
 memberName(id:string|null){return id?this.teamMembers().find(m=>m.user_id===id)?.display_name??'Membre':'Non assignée';}
 columnTasks(status:string){return this.tasks().filter(t=>t.status===status&&(!this.assigneeFilter||(this.assigneeFilter==='none'?!t.assignee_id:t.assignee_id===this.assigneeFilter)));}
 async run(action:()=>Promise<unknown>){if(this.busy())return;this.busy.set(true);this.message.set('');try{await action();}catch(e){this.message.set(e instanceof Error?e.message:'Action impossible.');}finally{this.busy.set(false);}}
 async selectTeam(id:string){if(this.busy())return;this.teamId=id;this.projectId='';this.assigneeFilter='';this.projects.set([]);this.tasks.set([]);this.subtasks.set([]);this.cardDrafts={};this.clearDraft();const revision=++this.revision;if(!id)return;await this.run(async()=>{const r=await this.auth.client.from('taskboard_shared_projects').select('id,team_id,title').eq('team_id',id).order('created_at');if(r.error)throw new Error(r.error.message);if(revision===this.revision)this.projects.set(r.data??[]);});}
 async selectProject(id:string){if(this.busy())return;this.projectId=id;this.tasks.set([]);this.subtasks.set([]);this.cardDrafts={};this.clearDraft();await this.refreshTasks();}
 async readTasks(){const id=this.projectId,revision=this.revision;if(!id)return;const r=await this.auth.client.from('taskboard_shared_tasks').select('*').eq('project_id',id).order('created_at');if(r.error)throw new Error(r.error.message);const ids=(r.data??[]).map((t:SharedTask)=>t.id);const subs=ids.length?await this.auth.client.from('taskboard_shared_subtasks').select('*').in('task_id',ids).order('created_at'):{data:[],error:null};if(subs.error)throw new Error(subs.error.message);if(id===this.projectId&&revision===this.revision){this.tasks.set(r.data??[]);this.subtasks.set(subs.data??[]);}}
 async refreshTasks(){await this.run(()=>this.readTasks());}
 async createProject(){if(!this.canManage()||!this.projectTitle.trim())return;await this.run(async()=>{const r=await this.auth.client.from('taskboard_shared_projects').insert({team_id:this.teamId,title:this.projectTitle.trim()}).select('id,team_id,title').single();if(r.error)throw new Error(r.error.message);this.projects.update(p=>[...p,r.data]);this.projectId=r.data.id;this.projectTitle='';this.tasks.set([]);this.subtasks.set([]);this.cardDrafts={};this.clearDraft();this.message.set('Projet partagé créé.');});}
 clearDraft(){this.title='';this.description='';this.status='todo';this.assignee='';}
 async saveTask(){if(!this.canEdit()||!this.title.trim())return;await this.run(async()=>{const payload={title:this.title.trim(),description:this.description,status:this.status,assignee_id:this.assignee||null};const query=this.auth.client.from('taskboard_shared_tasks').insert({...payload,team_id:this.teamId,project_id:this.projectId});const r=await query.select('id');if(r.error)throw new Error(r.error.message);if(!r.data?.length)throw new Error('La tâche a été supprimée ou vos droits ont changé.');await this.readTasks();this.clearDraft();this.message.set('Tâche enregistrée.');});}

 cardDrafts:Record<string,{title:string;description:string}>={};
 cardDraft(task:SharedTask){return this.cardDrafts[task.id]??{title:task.title,description:task.description};}
 setCardDraft(task:SharedTask,field:'title'|'description',value:string){this.cardDrafts[task.id]={...this.cardDraft(task),[field]:value};}
 cardDirty(task:SharedTask){const d=this.cardDraft(task);return d.title!==task.title||d.description!==task.description;}
 discardCard(id:string){delete this.cardDrafts[id];}
 async saveCard(task:SharedTask){const d=this.cardDraft(task);if(!this.canEdit()||!d.title.trim())return;await this.run(async()=>{const r=await this.auth.client.from('taskboard_shared_tasks').update({title:d.title.trim(),description:d.description}).eq('id',task.id).eq('project_id',this.projectId).select('id');if(r.error)throw new Error(r.error.message);if(!r.data?.length)throw new Error('Modification refusée.');this.discardCard(task.id);await this.readTasks();this.message.set('Tâche enregistrée.');});}
 async assignTask(id:string,assignee:string){if(!this.canEdit())return;await this.run(async()=>{const r=await this.auth.client.from('taskboard_shared_tasks').update({assignee_id:assignee||null}).eq('id',id).eq('project_id',this.projectId).select('id');if(r.error)throw new Error(r.error.message);if(!r.data?.length)throw new Error('Modification refusée.');await this.readTasks();});}
 canWork(assigned:string|null){return this.canEdit() || (!!assigned&&assigned===this.auth.user()?.id);}
 taskSubtasks(id:string){return this.subtasks().filter(s=>s.task_id===id);}
 subDone(id:string){return this.taskSubtasks(id).filter(s=>s.completed).length;}
 doneCount(){return this.tasks().filter(t=>t.status==='done').length;}
 completedSubtasks(){return this.subtasks().filter(s=>s.completed).length;}
 progress(){return this.tasks().length?Math.round(100*this.doneCount()/this.tasks().length):0;}
 async progressWork(id:string,sub:boolean,status:string){await this.run(async()=>{const r=await this.auth.client.rpc('progress_taskboard_work',{work_id:id,is_subtask:sub,new_status:status});if(r.error)throw new Error(r.error.message);await this.readTasks();});}
 async addSubtask(taskId:string){const title=this.subTitles[taskId]?.trim();if(!title||!this.canEdit())return;await this.run(async()=>{const r=await this.auth.client.from('taskboard_shared_subtasks').insert({task_id:taskId,team_id:this.teamId,title,assignee_id:this.subAssignees[taskId]||null});if(r.error)throw new Error(r.error.message);this.subTitles[taskId]='';await this.readTasks();this.message.set('Sous-tâche ajoutée.');});}
 async assignSubtask(id:string,assignee:string){await this.run(async()=>{const r=await this.auth.client.from('taskboard_shared_subtasks').update({assignee_id:assignee||null}).eq('id',id).select('id');if(r.error)throw new Error(r.error.message);if(!r.data?.length)throw new Error('Modification refusée.');await this.readTasks();});}
}
