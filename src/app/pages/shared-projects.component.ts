import { UiFieldDirective } from '../shared/ui-field.directive';
import { HostListener, Component, effect, inject, signal, untracked, DestroyRef, afterNextRender, Injector } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageShellComponent } from './page-shell.component';
import { AuthService } from '../services/auth.service';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
import { validSchedule } from '../core/calendar';
import { ProjectSettingsComponent, SharedProjectSettings, ProjectParticipant } from './collaboration-settings.component';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PremiumAccessComponent } from '../shared/premium-access.component';

interface Subtask {id:string;task_id:string;team_id:string;title:string;completed:boolean;assignee_id:string|null;}
interface Project extends SharedProjectSettings {}
interface SharedTask {id:string;project_id:string;team_id:string;title:string;description:string;status:string;assignee_id:string|null;start_date?:string|null;end_date?:string|null;}
interface TaskDocument {id:string;task_id:string;team_id:string;uploaded_by:string|null;file_name:string;content_type:string;size_bytes:number;object_path:string;is_central:boolean;created_at:string;}

@Component({standalone:true,imports:[PremiumAccessComponent,ProjectSettingsComponent,RouterLink,UiFieldDirective,ModalScrollLockDirective,AvatarComponent,A11yModule,TaskCardComponent,IconComponent,CommonModule,FormsModule,PageShellComponent],templateUrl:'./shared-projects.component.html'})
export class SharedProjectsComponent {
 startDate='';endDate='';
 readonly validSchedule=validSchedule;
 readonly toast=inject(ToastService);readonly appearance=inject(CardAppearanceService);readonly auth=inject(AuthService);readonly teams=inject(TeamService);private readonly sanitizer=inject(DomSanitizer);
 private readonly route=inject(ActivatedRoute);
 private readonly routeParams=toSignal(this.route.queryParamMap);
 private readonly routeFragment=toSignal(this.route.fragment);
 private readonly injector=inject(Injector);
 readonly highlightedTask=signal('');readonly highlightedSubtask=signal('');
 private handledNotification='';
 private readonly notificationNavigation=effect(()=>{
  const fragment=this.routeFragment(),params=this.routeParams(),tasks=this.tasks(),subs=this.subtasks();
  const id=fragment?.startsWith('task-')?fragment.slice(5):'';
  const sub=params?.get('subtask')??'';
  const key=[params?.get('team'),params?.get('project'),fragment,sub].join('/');
  if(!id){this.handledNotification='';this.highlightedTask.set('');this.highlightedSubtask.set('');return;}
  if(key===this.handledNotification||!tasks.some(t=>t.id===id))return;
  untracked(()=>{
   this.handledNotification=key;this.selectedId=id;this.creating=false;this.projectForm=false;void this.openCentralPreview(id);
   this.highlightedTask.set(id);this.highlightedSubtask.set(subs.some(s=>s.id===sub&&s.task_id===id)?sub:'');
   afterNextRender(()=>{
    const target=document.getElementById('subtask-'+this.highlightedSubtask());
    target?.scrollIntoView({block:'center',behavior:'instant'});target?.focus({preventScroll:true});
   },{injector:this.injector});
  });
 });
 readonly subtasks=signal<Subtask[]>([]);readonly documents=signal<TaskDocument[]>([]);readonly documentsMessage=signal('');readonly centralPreview=signal<{document:TaskDocument;url:SafeResourceUrl;openUrl:string}|null>(null);draggingTaskId='';editingDocumentId='';documentDraft='';documentOriginal='';subTitles:Record<string,string>={};subAssignees:Record<string,string>={};
 readonly projects=signal<Project[]>([]);readonly tasks=signal<SharedTask[]>([]);readonly message=signal('');readonly busy=signal(false);
 selectedId='';creating=false;projectForm=false;confirmDiscard=false;
 teamId='';projectId='';projectTitle='';assigneeFilter='';search='';title='';description='';status='todo';assignee='';
 viewMode:'board'|'workspace'='board';workspaceSelectedId='';
 readonly premiumActive=signal(false);
 premiumStatusChanged(active:boolean){this.premiumActive.set(active);if(!active)this.viewMode='board';}
 selectView(mode:'board'|'workspace'){if(mode==='workspace'&&!this.premiumActive()){this.toast.success('L’espace de travail est réservé aux comptes ayant un accès Premium actif.');return;}this.viewMode=mode;}
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
 constructor(){this.destroyRef.onDestroy(()=>{this.revision++;this.stopLive();});effect(()=>{this.routeParams();const user=this.auth.user();if(!this.auth.initializing())untracked(()=>{this.stopLive();this.revision++;this.selectedId='';this.creating=false;this.projectForm=false;this.confirmDiscard=false;this.teamId='';this.projectId='';this.projects.set([]);this.tasks.set([]);this.subtasks.set([]);this.documents.set([]);this.cardDrafts={};this.clearDraft();if(user)void this.run(async()=>{await this.teams.load();const tid=this.route.snapshot.queryParamMap.get('team') || this.teams.teams()[0]?.id;if(tid&&this.teams.teams().some(t=>t.id===tid)){this.teamId=tid;const r=await this.auth.client.from('taskboard_shared_projects').select('*').eq('team_id',tid);if(r.error)throw new Error(r.error.message);this.projects.set(r.data??[]);const pid=this.route.snapshot.queryParamMap.get('project');if(pid&&this.projects().some(p=>p.id===pid)){this.projectId=pid;await this.readTasks();}}});});});}

 selectedTask(){return this.tasks().find(t=>t.id===this.selectedId);}
 asCard(task:SharedTask):Task{return sharedCard(task,this.subtasks());}
 openTask(id:string){if(this.busy())return;this.selectedId=id;this.confirmDiscard=false;this.documentsMessage.set('');this.centralPreview.set(null);void this.openCentralPreview(id);}
 openCreate(status:string){if(this.busy())return;this.clearDraft();this.status=status;this.creating=true;this.confirmDiscard=false;}
 closePanel(){if(this.busy())return;const task=this.selectedTask();if((task&&(this.cardDirty(task)||this.subTitles[task.id]?.trim()))||(this.editingDocumentId&&this.documentDraft!==this.documentOriginal)||(this.creating&&(this.title.trim()||this.description.trim()||this.startDate||this.endDate))||(this.projectForm&&this.projectTitle.trim())){this.confirmDiscard=true;return;}this.dismissPanel();}
 dismissPanel(){if(this.busy())return;if(this.selectedId){this.discardCard(this.selectedId);delete this.subTitles[this.selectedId];delete this.subAssignees[this.selectedId];}this.cancelTextEdit();this.selectedId='';this.creating=false;this.projectForm=false;this.confirmDiscard=false;this.clearDraft();this.projectTitle='';}
 prepareNavigation(){if(this.selectedId||this.creating||this.projectForm){this.closePanel();return !this.confirmDiscard;}return true;}
 @HostListener('window:beforeunload',['$event']) beforeUnload(event:BeforeUnloadEvent){const task=this.selectedTask();if((task&&this.cardDirty(task))||(this.editingDocumentId&&this.documentDraft!==this.documentOriginal)||(this.creating&&(this.title.trim()||this.startDate||this.endDate))||(this.projectForm&&this.projectTitle.trim()))event.preventDefault();}
 trackTask(_index:number,task:{id:string}){return task.id;}
 initials(id:string|null){return id?this.memberName(id).split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase():'—';}
 currentTeam(){return this.teams.teams().find(t=>t.id===this.teamId);}
 currentProject(){return this.projects().find(p=>p.id===this.projectId);}
 readonly projectParticipants=signal<ProjectParticipant[]>([]);
 canConfigure(){const t=this.currentTeam();return !!t&&this.teams.canManage(t);}
 canManage(){return this.canConfigure()&&!this.currentTeam()?.archived_at;}
 canEdit(){const t=this.currentTeam(),p=this.currentProject();if(!t||t.archived_at||p?.archived_at)return false;const role=this.teams.role(t);return role==='owner'||role==='admin'||(role==='member'&&(p?.access_mode!=='restricted'||this.projectParticipants().some(m=>m.project_id===p.id&&m.user_id===this.auth.user()?.id&&m.role==='member')));}
 async settingsChanged(){const account=this.auth.user()?.id,tid=this.teamId;const r=await this.auth.client.from('taskboard_shared_projects').select('*').eq('team_id',tid).order('created_at');if(r.error){this.message.set('Actualisation des paramètres impossible. Rechargez la page.');return;}if(account!==this.auth.user()?.id||tid!==this.teamId)return;this.projects.set(r.data??[]);this.selectedId='';this.creating=false;this.cardDrafts={};if(this.projectId&&!this.currentProject()){this.projectId='';this.tasks.set([]);this.subtasks.set([]);this.stopLive();}else await this.refreshTasks();}
 teamMembers(){return this.teams.members().filter(m=>m.team_id===this.teamId);}
 memberAvatar(id:string|null){return this.teamMembers().find(m=>m.user_id===id)?.avatar_url??'';}
 memberName(id:string|null){return id?this.teamMembers().find(m=>m.user_id===id)?.display_name??'Membre':'Non assignée';}
 projectName(){return this.projects().find(p=>p.id===this.projectId)?.title??'Projet';}
 workspaceTasks(){const query=this.search.trim().toLocaleLowerCase('fr');return this.tasks().filter(t=>(!query||[t.title,t.description,...this.taskSubtasks(t.id).map(s=>s.title)].join(' ').toLocaleLowerCase('fr').includes(query))&&matchesSharedAssignee(t,this.subtasks(),this.assigneeFilter));}
 workspaceTask(){const visible=this.workspaceTasks();return visible.find(t=>t.id===this.workspaceSelectedId)??visible[0];}
 taskStatusLabel(status:string){return this.columns.find(column=>column.id===status)?.label??'À faire';}
 columnTasks(status:string){const query=this.search.trim().toLocaleLowerCase('fr');return this.tasks().filter(t=>t.status===status&&(!query||[t.title,t.description,...this.taskSubtasks(t.id).map(s=>s.title)].join(' ').toLocaleLowerCase('fr').includes(query))&&matchesSharedAssignee(t,this.subtasks(),this.assigneeFilter));}
 async run(action:()=>Promise<unknown>){if(this.busy())return;this.busy.set(true);this.message.set('');try{await action();}catch(e){this.message.set(e instanceof Error?e.message:'Action impossible.');}finally{this.busy.set(false);}}
 async selectTeam(id:string){if(this.busy())return;if(!this.prepareNavigation())return;this.stopLive();this.teamId=id;this.projectId='';this.assigneeFilter='';this.search='';this.projects.set([]);this.tasks.set([]);this.subtasks.set([]);this.documents.set([]);this.cardDrafts={};this.clearDraft();const revision=++this.revision;if(!id)return;await this.run(async()=>{const r=await this.auth.client.from('taskboard_shared_projects').select('*').eq('team_id',id).order('created_at');if(r.error)throw new Error(r.error.message);if(revision===this.revision)this.projects.set(r.data??[]);});}
 async selectProject(id:string){if(this.busy())return;if(!this.prepareNavigation())return;this.stopLive();this.projectId=id;this.tasks.set([]);this.subtasks.set([]);this.documents.set([]);this.cardDrafts={};this.clearDraft();await this.refreshTasks();}
 async readTasks(){
  const id=this.projectId,revision=this.revision,account=this.auth.user()?.id;
  if(!id)return;
  const meta=await this.auth.client.from('taskboard_shared_projects').select('*').eq('id',id).maybeSingle();
  if(revision!==this.revision||id!==this.projectId||account!==this.auth.user()?.id)return;
  if(meta.error)throw new Error('Actualisation du projet impossible.');
  if(!meta.data){this.tasks.set([]);this.subtasks.set([]);this.projectParticipants.set([]);this.selectedId='';this.creating=false;this.stopLive();throw new Error('Ce projet n’est plus accessible. Revenez à la liste des projets.');}
  const [r,roles,team]=await Promise.all([
   this.auth.client.from('taskboard_shared_tasks').select('*').eq('project_id',id).order('created_at'),
   this.auth.client.from('taskboard_project_members').select('project_id,user_id,role').eq('project_id',id),
   this.auth.client.from('taskboard_teams').select('*').eq('id',meta.data.team_id).maybeSingle()
  ]);
  if(r.error||roles.error||team.error||!team.data)throw new Error('Actualisation des travaux ou des accès impossible.');
  const ids=(r.data??[]).map((t:SharedTask)=>t.id);
  const [subs,docs]=await Promise.all([
   ids.length?this.auth.client.from('taskboard_shared_subtasks').select('*').in('task_id',ids).order('created_at'):Promise.resolve({data:[],error:null}),
   ids.length?this.auth.client.from('taskboard_shared_task_documents').select('id,task_id,team_id,uploaded_by,file_name,content_type,size_bytes,object_path,is_central,created_at').in('task_id',ids).order('created_at',{ascending:false}):Promise.resolve({data:[],error:null})
  ]);
  if(subs.error||docs.error)throw new Error('Actualisation des tâches, sous-tâches ou documents impossible.');
  if(id===this.projectId&&revision===this.revision&&account===this.auth.user()?.id){
   this.projects.update(items=>items.map(p=>p.id===id?meta.data:p));
   this.teams.teams.update(items=>items.map(t=>t.id===team.data!.id?team.data!:t));
   this.projectParticipants.set(roles.data??[]);this.tasks.set(r.data??[]);this.subtasks.set(subs.data??[]);this.documents.set(docs.data??[]);if(this.selectedId)void this.openCentralPreview(this.selectedId);this.startLive(id);
  }
 }
 async refreshTasks(){await this.run(()=>this.readTasks());}
 async createProject(){if(!this.canManage()||!this.projectTitle.trim())return;await this.run(async()=>{const r=await this.auth.client.from('taskboard_shared_projects').insert({team_id:this.teamId,title:this.projectTitle.trim()}).select('*').single();if(r.error)throw new Error(r.error.message);this.projects.update(p=>[...p,r.data]);this.stopLive();this.projectId=r.data.id;this.projectTitle='';this.projectForm=false;this.tasks.set([]);this.subtasks.set([]);this.cardDrafts={};this.clearDraft();await this.readTasks();this.toast.success('Projet partagé créé.');});}
 clearDraft(){this.title='';this.description='';this.status='todo';this.assignee='';this.startDate='';this.endDate='';}
 async saveTask(){if(!this.canEdit()||!this.title.trim())return;await this.run(async()=>{if(!validSchedule(this.startDate,this.endDate))throw new Error('La fin prévue doit être égale ou postérieure au début.');const payload={title:this.title.trim(),description:this.description,status:this.status,assignee_id:this.assignee||null,start_date:this.startDate||null,end_date:this.endDate||null};const query=this.auth.client.from('taskboard_shared_tasks').insert({...payload,team_id:this.teamId,project_id:this.projectId});const r=await query.select('id');if(r.error)throw new Error(r.error.message);if(!r.data?.length)throw new Error('La tâche a été supprimée ou vos droits ont changé.');await this.readTasks();this.clearDraft();this.creating=false;this.toast.success('Tâche enregistrée.');});}

 cardDrafts:Record<string,{title:string;description:string;start_date:string;end_date:string}>={};
 cardDraft(task:SharedTask){return this.cardDrafts[task.id]??{title:task.title,description:task.description,start_date:task.start_date??'',end_date:task.end_date??''};}
 setCardDraft(task:SharedTask,field:'title'|'description'|'start_date'|'end_date',value:string){this.cardDrafts[task.id]={...this.cardDraft(task),[field]:value};}
 cardDirty(task:SharedTask){const d=this.cardDraft(task);return d.title!==task.title||d.description!==task.description||d.start_date!==(task.start_date??'')||d.end_date!==(task.end_date??'');}
 discardCard(id:string){delete this.cardDrafts[id];}
 async saveCard(task:SharedTask){const d=this.cardDraft(task);if(!this.canEdit()||!d.title.trim())return;await this.run(async()=>{if(!validSchedule(d.start_date,d.end_date))throw new Error('La fin prévue doit être égale ou postérieure au début.');const r=await this.auth.client.from('taskboard_shared_tasks').update({title:d.title.trim(),description:d.description,start_date:d.start_date||null,end_date:d.end_date||null}).eq('id',task.id).eq('project_id',this.projectId).select('id');if(r.error)throw new Error(r.error.message);if(!r.data?.length)throw new Error('Modification refusée.');this.discardCard(task.id);await this.readTasks();this.toast.success('Tâche enregistrée.');});}
 async assignTask(id:string,assignee:string){if(!this.canEdit())return;await this.run(async()=>{const r=await this.auth.client.from('taskboard_shared_tasks').update({assignee_id:assignee||null}).eq('id',id).eq('project_id',this.projectId).select('id');if(r.error)throw new Error(r.error.message);if(!r.data?.length)throw new Error('Modification refusée.');await this.readTasks();});}
 canWork(_assigned:string|null){return this.canEdit();}
 taskSubtasks(id:string){return this.subtasks().filter(s=>s.task_id===id);}
 taskDocuments(id:string){return this.documents().filter(file=>file.task_id===id).sort((a,b)=>Number(b.is_central)-Number(a.is_central)||b.created_at.localeCompare(a.created_at));}
 hasCentralDocument(id:string){return this.taskDocuments(id).some(file=>file.is_central);}
 editingTextDocument(){return this.documents().find(file=>file.id===this.editingDocumentId&&file.task_id===this.selectedId);}
 private async openCentralPreview(taskId:string){
  const file=this.taskDocuments(taskId).find(item=>item.is_central);
  this.centralPreview.set(null);
  if(!file||!['application/pdf','image/jpeg','image/png','image/webp','text/plain','text/csv'].includes(file.content_type))return;
  try{
   const result=await this.auth.client.storage.from(this.documentBucket).createSignedUrl(file.object_path,300);
   if(result.error||!result.data||this.selectedId!==taskId||!this.taskDocuments(taskId).some(item=>item.id===file.id&&item.is_central))return;
   this.centralPreview.set({document:file,url:this.sanitizer.bypassSecurityTrustResourceUrl(result.data.signedUrl),openUrl:result.data.signedUrl});
  }catch{this.documentsMessage.set('Aperçu du document central indisponible. Vous pouvez le télécharger ci-dessous.');}
 }
 readonly documentBucket='team-task-documents';readonly documentMaxBytes=20*1024*1024;
 private readonly documentMimeByExtension:Record<string,string>={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',txt:'text/plain',csv:'text/csv',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
 private safeDocumentName(name:string){return name.replace(/[\\/]/g,'_').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,255)||'document';}
 formatDocumentSize(size:number){if(size<1024)return `${size} o`;const units=['Ko','Mo'];let value=size/1024,index=0;while(value>=1024&&index<units.length-1){value/=1024;index++;}return `${new Intl.NumberFormat('fr',{maximumFractionDigits:1}).format(value)} ${units[index]}`;}
 onDocumentInput(taskId:string,event:Event){const input=event.target as HTMLInputElement;if(input.files)void this.uploadDocuments(taskId,input.files);input.value='';}
 onDocumentDrop(taskId:string,event:DragEvent){event.preventDefault();this.draggingTaskId='';if(event.dataTransfer?.files)void this.uploadDocuments(taskId,event.dataTransfer.files);}
 async uploadDocuments(taskId:string,files:FileList|File[]){
  if(!this.premiumActive()){this.documentsMessage.set('L’ajout de documents est réservé aux comptes ayant un accès Premium actif.');return;}
  if(!this.canEdit()||!this.tasks().some(task=>task.id===taskId)||this.busy())return;
  const selected=Array.from(files);if(!selected.length)return;
  if(selected.length>10){this.documentsMessage.set('Ajoutez au maximum 10 fichiers à la fois.');return;}
  const prepared=selected.map(file=>{const extension=file.name.split('.').pop()?.toLowerCase()??'';return{file,extension,contentType:file.type.split(';',1)[0].trim().toLowerCase()||this.documentMimeByExtension[extension]||''};});
  const invalid=prepared.find(({file,extension,contentType})=>file.size<1||file.size>this.documentMaxBytes||!this.documentMimeByExtension[extension]||contentType!==this.documentMimeByExtension[extension]);
  if(invalid){this.documentsMessage.set(`Fichier refusé : ${invalid.file.name}. Formats acceptés : PDF, images JPG/PNG/WEBP, Word, Excel, CSV et TXT ; 20 Mo maximum par fichier.`);return;}
  this.documentsMessage.set('');
  await this.run(async()=>{
   for(const item of prepared){
    const id=crypto.randomUUID(),objectPath=`${this.teamId}/${taskId}/${id}`,fileName=this.safeDocumentName(item.file.name);
    const metadata=await this.auth.client.from('taskboard_shared_task_documents').insert({id,task_id:taskId,team_id:this.teamId,file_name:fileName,content_type:item.contentType,size_bytes:item.file.size,object_path:objectPath}).select('id').maybeSingle();
    if(metadata.error||!metadata.data)throw new Error(metadata.error?.message??'Enregistrement du document impossible.');
    const upload=await this.auth.client.storage.from(this.documentBucket).upload(objectPath,item.file,{contentType:item.contentType,upsert:false});
    if(upload.error){await this.auth.client.from('taskboard_shared_task_documents').delete().eq('id',id);throw new Error(`Envoi de « ${fileName} » impossible : ${upload.error.message}`);}
   }
   await this.readTasks();this.toast.success(selected.length===1?'Document ajouté à la tâche.':`${selected.length} documents ajoutés à la tâche.`);
  });
 }
 async downloadDocument(file:TaskDocument){await this.run(async()=>{const result=await this.auth.client.storage.from(this.documentBucket).createSignedUrl(file.object_path,60,{download:file.file_name});if(result.error||!result.data)throw new Error('Téléchargement du document impossible.');const link=document.createElement('a');link.href=result.data.signedUrl;link.download=file.file_name;link.rel='noopener';link.click();});}
 async editTextDocument(file:TaskDocument){
  if(!this.premiumActive()){this.documentsMessage.set('La modification des documents nécessite un accès Premium actif.');return;}
  if(!this.canEdit()||file.content_type!=='text/plain'||this.busy())return;
  await this.run(async()=>{const result=await this.auth.client.storage.from(this.documentBucket).download(file.object_path);if(result.error||!result.data)throw new Error('Lecture du fichier TXT impossible.');this.documentDraft=await result.data.text();this.documentOriginal=this.documentDraft;this.editingDocumentId=file.id;});
 }
 cancelTextEdit(){this.editingDocumentId='';this.documentDraft='';this.documentOriginal='';}
 async saveTextDocument(file:TaskDocument){
  if(!this.premiumActive()){this.documentsMessage.set('La modification des documents nécessite un accès Premium actif.');return;}
  if(!this.canEdit()||this.editingDocumentId!==file.id||file.content_type!=='text/plain'||this.busy())return;
  const replacement=new Blob([this.documentDraft],{type:'text/plain'});
  if(replacement.size<1||replacement.size>this.documentMaxBytes){this.documentsMessage.set('Le fichier TXT doit contenir du texte et ne pas dépasser 20 Mo.');return;}
  if(!window.confirm(`Enregistrer les modifications et remplacer définitivement « ${file.file_name} » ?`))return;
  await this.run(async()=>{
   const id=crypto.randomUUID(),objectPath=`${file.team_id}/${file.task_id}/${id}`;
   const metadata=await this.auth.client.from('taskboard_shared_task_documents').insert({id,task_id:file.task_id,team_id:file.team_id,file_name:file.file_name,content_type:'text/plain',size_bytes:replacement.size,object_path:objectPath}).select('id').maybeSingle();
   if(metadata.error||!metadata.data)throw new Error(metadata.error?.message??'Préparation du remplacement impossible.');
   const upload=await this.auth.client.storage.from(this.documentBucket).upload(objectPath,replacement,{contentType:'text/plain',upsert:false});
   if(upload.error){await this.auth.client.from('taskboard_shared_task_documents').delete().eq('id',id);throw new Error(`Enregistrement du nouveau fichier impossible : ${upload.error.message}`);}
   if(file.is_central){const central=await this.auth.client.rpc('set_taskboard_central_document',{document_uuid:id});if(central.error){await this.auth.client.storage.from(this.documentBucket).remove([objectPath]);await this.auth.client.from('taskboard_shared_task_documents').delete().eq('id',id);throw new Error('Le document central n’a pas pu être remplacé ; la version précédente est conservée.');}}
   const removed=await this.auth.client.storage.from(this.documentBucket).remove([file.object_path]);
   if(removed.error)throw new Error('La nouvelle version est enregistrée, mais l’ancienne n’a pas pu être retirée. Les deux fichiers restent dans la liste.');
   const oldRow=await this.auth.client.from('taskboard_shared_task_documents').delete().eq('id',file.id).select('id');
   if(oldRow.error||!oldRow.data?.length)throw new Error('Le fichier a été remplacé, mais son ancienne fiche n’a pas pu être retirée. Actualisez la liste.');
   this.cancelTextEdit();await this.readTasks();this.toast.success('Fichier TXT remplacé.');
  });
 }
 async markCentralDocument(file:TaskDocument){if(!this.premiumActive()){this.documentsMessage.set('Le document central nécessite un accès Premium actif.');return;}if(!this.canEdit()||this.busy())return;await this.run(async()=>{const result=await this.auth.client.rpc('set_taskboard_central_document',{document_uuid:file.id});if(result.error)throw new Error('Impossible de définir le document central.');await this.readTasks();});}
 async removeTaskDocument(file:TaskDocument){if(!this.canEdit()||this.busy()||!window.confirm(`Retirer « ${file.file_name} » de cette tâche ?`))return;await this.run(async()=>{const object=this.auth.client.storage.from(this.documentBucket);const removed=await object.remove([file.object_path]);if(removed.error)throw new Error(`Suppression du fichier impossible : ${removed.error.message}`);const row=await this.auth.client.from('taskboard_shared_task_documents').delete().eq('id',file.id).select('id');if(row.error||!row.data?.length)throw new Error('Le fichier a été retiré du stockage, mais sa fiche n’a pas pu être supprimée. Réessayez après actualisation.');await this.readTasks();this.toast.success('Document retiré de la tâche.');});}
 subDone(id:string){return this.taskSubtasks(id).filter(s=>s.completed).length;}
 doneCount(){return this.tasks().filter(t=>t.status==='done').length;}
 completedSubtasks(){return this.subtasks().filter(s=>s.completed).length;}
 progress(){return this.tasks().length?Math.round(100*this.doneCount()/this.tasks().length):0;}
 async progressWork(id:string,sub:boolean,status:string){await this.run(async()=>{const r=await this.auth.client.rpc('progress_taskboard_work',{work_id:id,is_subtask:sub,new_status:status});if(r.error)throw new Error(r.error.message);await this.readTasks();});}
 async addSubtask(taskId:string){const title=this.subTitles[taskId]?.trim();if(!title||!this.canEdit())return;await this.run(async()=>{const r=await this.auth.client.from('taskboard_shared_subtasks').insert({task_id:taskId,team_id:this.teamId,title,assignee_id:this.subAssignees[taskId]||null});if(r.error)throw new Error(r.error.message);this.subTitles[taskId]='';await this.readTasks();this.toast.success('Sous-tâche ajoutée.');});}
 async assignSubtask(id:string,assignee:string){await this.run(async()=>{const r=await this.auth.client.from('taskboard_shared_subtasks').update({assignee_id:assignee||null}).eq('id',id).select('id');if(r.error)throw new Error(r.error.message);if(!r.data?.length)throw new Error('Modification refusée.');await this.readTasks();});}
}
