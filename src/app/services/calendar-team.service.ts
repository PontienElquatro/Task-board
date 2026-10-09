import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { TeamService } from './team.service';
import { Task } from '../models';
import { sharedCard, SharedCardTask } from '../core/collaboration/shared-card';
import { dayKey } from '../models/task-utils';
import { validSchedule } from '../core/calendar';

export type CalendarTask = Task & {teamId?:string; sharedProjectId?:string; assigneeId?:string;};
@Injectable()
export class CalendarTeamService {
 readonly auth=inject(AuthService);
 readonly teams=inject(TeamService);
 readonly tasks=signal<CalendarTask[]>([]);
 readonly projects=signal<{id:string;title:string;team_id:string}[]>([]);
 readonly loading=signal(false);
 readonly error=signal('');
 private revision=0;
 reset(){this.revision++;this.tasks.set([]);this.projects.set([]);this.error.set('');this.loading.set(false);}
 async load(){
  const account=this.auth.user()?.id,revision=++this.revision;
  this.loading.set(true);this.error.set('');
  if(!account){this.reset();return;}
  try {
   await this.teams.load();
   const [projects,tasks]=await Promise.all([
    this.auth.client.from('taskboard_shared_projects').select('id,title,team_id'),
    this.auth.client.from('taskboard_shared_tasks').select('id,title,description,status,assignee_id,project_id,team_id,start_date,end_date')
   ]);
   if(projects.error||tasks.error)throw new Error('Les tâches d’équipe sont indisponibles. Réessayez.');
   if(revision!==this.revision||account!==this.auth.user()?.id)return;
   this.projects.set(projects.data??[]);
   this.tasks.set((tasks.data??[]).map((t:SharedCardTask & {team_id:string;project_id:string})=>({
    ...sharedCard(t,[]),teamId:t.team_id,sharedProjectId:t.project_id,projectId:'team:'+t.project_id,assigneeId:t.assignee_id??''
   })));
  }catch(e){if(revision===this.revision)this.error.set(e instanceof Error?e.message:'Chargement impossible.');}
  finally{if(revision===this.revision)this.loading.set(false);}
 }
 canEdit(task:CalendarTask){
  const team=this.teams.teams().find(t=>t.id===task.teamId);
  return !!team&&['owner','admin','member'].includes(this.teams.role(team)??'');
 }
 async saveDates(task:CalendarTask,start:string,end:string){
  if(!this.canEdit(task))throw new Error('Votre rôle ne permet pas de modifier les dates.');
  if(!validSchedule(start,end))throw new Error('La fin prévue doit être postérieure ou égale au début.');
  const account=this.auth.user()?.id;
  const result=await this.auth.client.from('taskboard_shared_tasks')
   .update({start_date:start||null,end_date:end||null})
   .eq('id',task.id).eq('team_id',task.teamId!).eq('project_id',task.sharedProjectId!).select('id');
  if(result.error||!result.data?.length)throw new Error('Dates non enregistrées. Vérifiez vos droits et réessayez.');
  if(account!==this.auth.user()?.id)return;
  this.tasks.update(items=>items.map(t=>t.id===task.id?{...t,startDate:start?new Date(start+'T12:00:00'):undefined,dueDate:end?new Date(end+'T12:00:00'):undefined}:t));
 }
 dates(task:CalendarTask){return {start:task.startDate?dayKey(task.startDate):'',end:task.dueDate?dayKey(task.dueDate):''};}
}
