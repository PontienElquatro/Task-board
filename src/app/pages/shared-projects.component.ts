import { HostListener, Component, effect, inject, signal, untracked, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageShellComponent } from './page-shell.component';
import { AuthService } from '../services/auth.service';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { IconComponent } from '../shared/icon.component';
import { ToastService } from '../services/toast.service';
import { CardAppearanceService } from '../services/card-appearance.service';
import { RealtimeChannel } from '@supabase/supabase-js';
import { RefreshQueue } from '../core/collaboration/refresh-queue';
import { A11yModule } from '@angular/cdk/a11y';
import { AvatarComponent } from '../shared/avatar.component';
import { TaskCardComponent } from '../task-card/task-card.component';
import { Task } from '../models';
import { sharedCard, matchesSharedAssignee } from '../core/collaboration/shared-card';
import { TeamService } from '../services/team.service';
import { ModalScrollLockDirective } from '../shared/modal-scroll-lock.directive';

interface Subtask {id:string;task_id:string;team_id:string;title:string;completed:boolean;assignee_id:string|null;}
interface Project {id:string;team_id:string;title:string;}
interface SharedTask {id:string;project_id:string;team_id:string;title:string;description:string;status:string;assignee_id:string|null;}

@Component({standalone:true,imports:[ModalScrollLockDirective,AvatarComponent,A11yModule,TaskCardComponent,IconComponent,CommonModule,FormsModule,PageShellComponent],templateUrl:'./shared-projects.component.html'})
export class SharedProjectsComponent {
 readonly toast=inject(ToastService);readonly appearance=inject(CardAppearanceService);readonly auth=inject(AuthService);readonly teams=inject(TeamService);
 private readonly route=inject(ActivatedRoute);
 private readonly routeParams=toSignal(this.route.queryParamMap);
 readonly subtasks=signal<Subtask[]>([]);subTitles:Record<string,string>={};subAssignees:Record<string,string>={};
 readonly projects=signal<Project[]>([]);readonly tasks=signal<SharedTask[]>([]);readonly message=signal('');readonly busy=signal(false);
 selectedId='';creating=false;projectForm=false;confirmDiscard=false;
 teamId='';projectId='';projectTitle='';assigneeFilter='';search='';title='';description='';status='todo';assignee='';
 readonly columns=[{id:'todo',label:'À faire'},{id:'in-progress',label:'En cours'},{id:'done',label:'Terminé'}];
 readonly liveStatus=signal('Connexion au temps réel…');
 private liveChannel?:RealtimeChannel;
 private refreshQueue?:RefreshQueue;
 private liveProject='';
 private fallbackTimer?:ReturnType<typeof setInterval>;
 private readonly destroyRef=inject(DestroyRef);
 private revision=0;
 private readonly catchUp=()=>this.refreshQueue?.request();
 private startLive(id:string){
   if(this.liveProject===id || !this.auth.user() || typeof window==='undefined')return;
   this.stopLive();
   this.liveProject=id;
   this.liveStatus.set('Connexion au temps réel…');
   const queue=new RefreshQueue(()=>this.busy(),async()=>{
     if(this.liveProject!==id)return;
     this.busy.set(true);
     try{await this.readTasks();}
     catch{if(this.liveProject===id)this.liveStatus.set('Actualisation interrompue · nouvelle tentative automatique');}
     finally{this.busy.set(false);}
   });
   this.refreshQueue=queue;
   const changed=()=>queue.request();
   // Only authorized INSERT/UPDATE payloads. DELETE is recovered by the periodic
   // authenticated read because Postgres DELETE events cannot be RLS-filtered.
   this.liveChannel=this.auth.client.channel('shared-project-'+id+'-'+crypto.randomUUID())
     .on('postgres_changes',{event:'INSERT',schema:'public',table:'taskboard_shared_tasks',filter:'project_id=eq.'+id},changed)
     .on('postgres_changes',{event:'UPDATE',schema:'public',table:'taskboard_shared_tasks',filter:'project_id=eq.'+id},changed)
     .on('postgres_changes',{event:'INSERT',schema:'public',table:'taskboard_shared_subtasks',filter:'team_id=eq.'+this.teamId},changed)
     .on('postgres_changes',{event:'UPDATE',schema:'public',table:'taskboard_shared_subtasks',filter:'team_id=eq.'+this.teamId},changed)
     .subscribe(status=>{
       if(this.liveProject!==id)return;
       this.liveStatus.set(status==='SUBSCRIBED'?'En direct · mises à jour automatiques':'Connexion interrompue · rattrapage automatique');
       if(status==='SUBSCRIBED')queue.request();
     });
   this.fallbackTimer=setInterval(()=>queue.request(),30000);
   window.addEventListener('online',this.catchUp);
   window.addEventListener('focus',this.catchUp);
 }
 private stopLive(){
   this.liveProject='';
   this.refreshQueue?.dispose();this.refreshQueue=undefined;
   clearInterval(this.fallbackTimer);
   if(this.liveChannel)void this.auth.client.removeChannel(this.liveChannel);
   this.liveChannel=undefined;
   if(typeof window!=='undefined'){window.removeEventListener('online',this.catchUp);window.removeEventListener('focus',this.catchUp);}
 }
 constructor(){this.destroyRef.onDestroy(()=>{this.revision++;this.stopLive();});effect(()=>{this.routeParams();const user=this.auth.user();if(!this.auth.initializing())untracked(()=>{this.stopLive();this.revision++;this.selectedId='';this.creating=false;this.projectForm=false;this.confirmDiscard=false;this.teamId='';this.projectId='';this.projects.set([]);this.tasks.set([]);this.subtasks.set([]);this.cardDrafts={};this.clearDraft();if(user)void this.run(async()=>{await this.teams.load();const tid=this.route.snapshot.queryParamMap.get('team') || this.teams.teams()[0]?.id;if(tid&&this.teams.teams().some(t=>t.id===tid)){this.teamId=tid;const r=await this.auth.client.from('taskboard_shared_projects').select('id,team_id,title').eq('team_id',tid);if(r.error)throw new Error(r.error.message);this.projects.set(r.data??[]);const pid=this.route.snapshot.queryParamMap.get('project');if(pid&&this.projects().some(p=>p.id===pid)){this.projectId=pid;await this.readTasks();}}});});});}

 selectedTask(){return this.tasks().find(t=>t.id===this.selectedId);}
 asCard(task:SharedTask):Task{return sharedCard(task,this.subtasks());}
 openTask(id:string){if(this.busy())return;this.selectedId=id;this.confirmDiscard=false;}
 openCreate(status:string){if(this.busy())return;this.clearDraft();this.status=status;this.creating=true;this.confirmDiscard=false;}
 closePanel(){if(this.busy())return;const task=this.selectedTask();if((task&&(this.cardDirty(task)||this.subTitles[task.id]?.trim()))||(this.creating&&(this.title.trim()||this.description.trim()))||(this.projectForm&&this.projectTitle.trim())){this.confirmDiscard=true;return;}this.dismissPanel();}
 dismissPanel(){if(this.busy())return;if(this.selectedId){this.discardCard(this.selectedId);delete this.subTitles[this.selectedId];delete this.subAssignees[this.selectedId];}this.selectedId='';this.creating=false;this.projectForm=false;this.confirmDiscard=false;this.clearDraft();this.projectTitle='';}
 prepareNavigation(){if(this.selectedId||this.creating||this.projectForm){this.closePanel();return !this.confirmDiscard;}return true;}
 @HostListener('window:beforeunload',['$event']) beforeUnload(event:BeforeUnloadEvent){const task=this.selectedTask();if((task&&this.cardDirty(task))||(this.creating&&this.title.trim())||(this.projectForm&&this.projectTitle.trim()))event.preventDefault();}
 trackTask(_index:number,task:{id:string}){return task.id;}
 initials(id:string|null){return id?this.memberName(id).split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase():'—';}
 currentTeam(){return this.teams.teams().find(t=>t.id===this.teamId);}
 canManage(){const t=this.currentTeam();return !!t&&this.teams.canManage(t);}
 canEdit(){const t=this.currentTeam();return !!t&&['owner','admin','member'].includes(this.teams.role(t)??'');}
 teamMembers(){return this.teams.members().filter(m=>m.team_id===this.teamId);}
 memberAvatar(id:string|null){return this.teamMembers().find(m=>m.user_id===id)?.avatar_url??'';}
 memberName(id:string|null){return id?this.teamMembers().find(m=>m.user_id===id)?.display_name??'Membre':'Non assignée';}
 projectName(){return this.projects().find(p=>p.id===this.projectId)?.title??'Projet';}
 columnTasks(status:string){const query=this.search.trim().toLocaleLowerCase('fr');return this.tasks().filter(t=>t.status===status&&(!query||[t.title,t.description,...this.taskSubtasks(t.id).map(s=>s.title)].join(' ').toLocaleLowerCase('fr').includes(query))&&matchesSharedAssignee(t,this.subtasks(),this.assigneeFilter));}
 async run(action:()=>Promise<unknown>){if(this.busy())return;this.busy.set(true);this.message.set('');try{await action();}catch(e){this.message.set(e instanceof Error?e.message:'Action impossible.');}finally{this.busy.set(false);}}
 async selectTeam(id:string){if(this.busy())return;if(!this.prepareNavigation())return;this.stopLive();this.teamId=id;this.projectId='';this.assigneeFilter='';this.search='';this.projects.set([]);this.tasks.set([]);this.subtasks.set([]);this.cardDrafts={};this.clearDraft();const revision=++this.revision;if(!id)return;await this.run(async()=>{const r=await this.auth.client.from('taskboard_shared_projects').select('id,team_id,title').eq('team_id',id).order('created_at');if(r.error)throw new Error(r.error.message);if(revision===this.revision)this.projects.set(r.data??[]);});}
 async selectProject(id:string){if(this.busy())return;if(!this.prepareNavigation())return;this.stopLive();this.projectId=id;this.tasks.set([]);this.subtasks.set([]);this.cardDrafts={};this.clearDraft();await this.refreshTasks();}
 async readTasks(){const id=this.projectId,revision=this.revision;if(!id)return;const r=await this.auth.client.from('taskboard_shared_tasks').select('*').eq('project_id',id).order('created_at');if(r.error)throw new Error(r.error.message);const ids=(r.data??[]).map((t:SharedTask)=>t.id);const subs=ids.length?await this.auth.client.from('taskboard_shared_subtasks').select('*').in('task_id',ids).order('created_at'):{data:[],error:null};if(subs.error)throw new Error(subs.error.message);if(id===this.projectId&&revision===this.revision){this.tasks.set(r.data??[]);this.subtasks.set(subs.data??[]);this.startLive(id);}}
 async refreshTasks(){await this.run(()=>this.readTasks());}
 async createProject(){if(!this.canManage()||!this.projectTitle.trim())return;await this.run(async()=>{const r=await this.auth.client.from('taskboard_shared_projects').insert({team_id:this.teamId,title:this.projectTitle.trim()}).select('id,team_id,title').single();if(r.error)throw new Error(r.error.message);this.projects.update(p=>[...p,r.data]);this.stopLive();this.projectId=r.data.id;this.projectTitle='';this.projectForm=false;this.tasks.set([]);this.subtasks.set([]);this.cardDrafts={};this.clearDraft();await this.readTasks();this.toast.success('Projet partagé créé.');});}
 clearDraft(){this.title='';this.description='';this.status='todo';this.assignee='';}
 async saveTask(){if(!this.canEdit()||!this.title.trim())return;await this.run(async()=>{const payload={title:this.title.trim(),description:this.description,status:this.status,assignee_id:this.assignee||null};const query=this.auth.client.from('taskboard_shared_tasks').insert({...payload,team_id:this.teamId,project_id:this.projectId});const r=await query.select('id');if(r.error)throw new Error(r.error.message);if(!r.data?.length)throw new Error('La tâche a été supprimée ou vos droits ont changé.');await this.readTasks();this.clearDraft();this.creating=false;this.toast.success('Tâche enregistrée.');});}

 cardDrafts:Record<string,{title:string;description:string}>={};
 cardDraft(task:SharedTask){return this.cardDrafts[task.id]??{title:task.title,description:task.description};}
 setCardDraft(task:SharedTask,field:'title'|'description',value:string){this.cardDrafts[task.id]={...this.cardDraft(task),[field]:value};}
 cardDirty(task:SharedTask){const d=this.cardDraft(task);return d.title!==task.title||d.description!==task.description;}
 discardCard(id:string){delete this.cardDrafts[id];}
 async saveCard(task:SharedTask){const d=this.cardDraft(task);if(!this.canEdit()||!d.title.trim())return;await this.run(async()=>{const r=await this.auth.client.from('taskboard_shared_tasks').update({title:d.title.trim(),description:d.description}).eq('id',task.id).eq('project_id',this.projectId).select('id');if(r.error)throw new Error(r.error.message);if(!r.data?.length)throw new Error('Modification refusée.');this.discardCard(task.id);await this.readTasks();this.toast.success('Tâche enregistrée.');});}
 async assignTask(id:string,assignee:string){if(!this.canEdit())return;await this.run(async()=>{const r=await this.auth.client.from('taskboard_shared_tasks').update({assignee_id:assignee||null}).eq('id',id).eq('project_id',this.projectId).select('id');if(r.error)throw new Error(r.error.message);if(!r.data?.length)throw new Error('Modification refusée.');await this.readTasks();});}
 canWork(assigned:string|null){return this.canEdit() || (!!assigned&&assigned===this.auth.user()?.id);}
 taskSubtasks(id:string){return this.subtasks().filter(s=>s.task_id===id);}
 subDone(id:string){return this.taskSubtasks(id).filter(s=>s.completed).length;}
 doneCount(){return this.tasks().filter(t=>t.status==='done').length;}
 completedSubtasks(){return this.subtasks().filter(s=>s.completed).length;}
 progress(){return this.tasks().length?Math.round(100*this.doneCount()/this.tasks().length):0;}
 async progressWork(id:string,sub:boolean,status:string){await this.run(async()=>{const r=await this.auth.client.rpc('progress_taskboard_work',{work_id:id,is_subtask:sub,new_status:status});if(r.error)throw new Error(r.error.message);await this.readTasks();});}
 async addSubtask(taskId:string){const title=this.subTitles[taskId]?.trim();if(!title||!this.canEdit())return;await this.run(async()=>{const r=await this.auth.client.from('taskboard_shared_subtasks').insert({task_id:taskId,team_id:this.teamId,title,assignee_id:this.subAssignees[taskId]||null});if(r.error)throw new Error(r.error.message);this.subTitles[taskId]='';await this.readTasks();this.toast.success('Sous-tâche ajoutée.');});}
 async assignSubtask(id:string,assignee:string){await this.run(async()=>{const r=await this.auth.client.from('taskboard_shared_subtasks').update({assignee_id:assignee||null}).eq('id',id).select('id');if(r.error)throw new Error(r.error.message);if(!r.data?.length)throw new Error('Modification refusée.');await this.readTasks();});}
}
