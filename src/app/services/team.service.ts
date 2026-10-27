import { Injectable, effect, inject, signal } from '@angular/core';
import { teamInvitationLink } from '../core/auth/team-invitation-link';
import { profileName } from '../core/profile';
import { AuthService } from './auth.service';
export type TeamRole='owner'|'admin'|'member'|'viewer';
export interface TeamMember {team_id:string;user_id:string;role:TeamRole;display_name:string;avatar_url?:string|null;}
export interface Team{id:string;owner_id:string;name:string;created_at:string;description?:string;archived_at?:string|null;settings_version?:number;}
export interface TeamInvitation{id:string;team_id:string;email:string;role:Exclude<TeamRole,'owner'>;expires_at:string;created_at:string;accepted_at?:string|null;}
@Injectable({providedIn:'root'}) export class TeamService{
 private readonly auth=inject(AuthService); readonly teams=signal<Team[]>([]); readonly invitations=signal<TeamInvitation[]>([]); readonly members=signal<TeamMember[]>([]);
 private loadVersion=0;
 private account=this.auth.user()?.id;
 constructor(){effect(()=>{const account=this.auth.user()?.id;if(account!==this.account){this.account=account;++this.loadVersion;this.teams.set([]);this.members.set([]);this.invitations.set([]);}});}
 async load(){
 const version=++this.loadVersion;
 const account=this.auth.user()?.id;
 this.teams.set([]);this.members.set([]);this.invitations.set([]);
 if(!account)return;
 const result=await this.auth.client.from('taskboard_teams').select('*').order('created_at',{ascending:false});
 if(result.error)throw new Error('Chargement des équipes impossible.');
 let roster=await this.auth.client.rpc('taskboard_team_profiles');
 // Older backends remain usable until the additive migration is deployed.
 if(roster.error && ['PGRST202','42883'].includes(roster.error.code))roster=await this.auth.client.rpc('taskboard_team_roster');
 if(roster.error)throw new Error('Chargement des membres impossible : '+roster.error.message);
 const ids=(result.data??[]).map((x:{id:string})=>x.id);
 const invites=ids.length?await this.auth.client.from('taskboard_team_invitations').select('id,team_id,email,role,expires_at,created_at,accepted_at').in('team_id',ids).order('created_at',{ascending:false}):{data:[],error:null};
 if(invites.error)throw new Error('Chargement des invitations impossible.');
 if(this.auth.user()?.id!==account || version!==this.loadVersion)return;
 this.teams.set((result.data??[]) as Team[]);this.members.set((roster.data??[]).map((member:TeamMember)=>({...member,display_name:profileName({full_name:member.display_name})})));this.invitations.set((invites.data??[]) as TeamInvitation[]);
 }
 role(team:Team):TeamRole|undefined{return team.owner_id===this.auth.user()?.id?'owner':this.members().find(m=>m.team_id===team.id&&m.user_id===this.auth.user()?.id)?.role;}
 canManage(team:Team){return ['owner','admin'].includes(this.role(team)??'');}
 async settings(team:Team,operation:'save'|'close'|'reopen'|'leave'|'transfer',values:{new_name?:string;new_description?:string;successor?:string}={}){
  const account=this.auth.user()?.id;
  if(!account)throw new Error('Connectez-vous pour modifier cette équipe.');
  if(!team.settings_version)throw new Error('Les paramètres des équipes nécessitent la mise à jour du serveur.');
  const {error}=await this.auth.client.rpc('taskboard_team_settings',{tid:team.id,operation,expected_version:team.settings_version,...values});
  if(error)throw new Error(error.code==='PT409'?'Les paramètres ont changé. Actualisez puis réessayez.':error.message);
  if(account===this.auth.user()?.id)await this.load();
 }
 canEditMember(team:Team,member:{user_id:string;role:TeamRole}){return member.user_id!==team.owner_id && member.role!=='owner' && (this.role(team)==='owner' || (this.role(team)==='admin'&&['member','viewer'].includes(member.role)));}
 async manageMember(teamId:string,userId:string,role:string|null){const {error}=await this.auth.client.rpc('manage_taskboard_member',{tid:teamId,member_id:userId,new_role:role});if(error)throw new Error(error.message);await this.load();}
 roleLabel(role:string|undefined){return ({owner:'Propriétaire',admin:'Administrateur',member:'Membre',viewer:'Lecteur'} as Record<string,string>)[role??'']??'Membre';}
 status(invitation:TeamInvitation){return invitation.accepted_at?'Acceptée':new Date(invitation.expires_at).getTime()<=Date.now()?'Expirée':'En attente';}
 async cancel(id:string){const account=this.auth.user()?.id;const {error}=await this.auth.client.rpc('cancel_taskboard_invitation',{invitation_id:id});if(error)throw new Error(error.message);if(this.auth.user()?.id===account)this.invitations.update(items=>items.filter(i=>i.id!==id));}

 async create(name:string){const user=this.auth.user(),clean=name.trim();if(!user)throw new Error('Connectez-vous pour créer une équipe.');if(clean.length<2||clean.length>100)throw new Error('Le nom doit contenir de 2 à 100 caractères.');const {data,error}=await this.auth.client.from('taskboard_teams').insert({owner_id:user.id,name:clean}).select().single();if(error)throw new Error('Création impossible : '+error.message);if(this.auth.user()?.id!==user.id)return;const team=data as Team;this.teams.update(items=>[team,...items]);await this.load();}
 async invite(teamId:string,email:string,role:Exclude<TeamRole,'owner'>){const user=this.auth.user(),clean=email.trim().toLowerCase();if(!user)throw new Error('Connectez-vous pour inviter un membre.');if(!/^\S+@\S+\.\S+$/.test(clean))throw new Error('Adresse email invalide.');const token=crypto.randomUUID()+crypto.randomUUID();const {data,error}=await this.auth.client.from('taskboard_team_invitations').insert({team_id:teamId,email:clean,role,invited_by:user.id,token_hash:token}).select('id,team_id,email,role,expires_at,created_at').single();if(error)throw new Error('Invitation impossible : '+error.message);if(this.auth.user()?.id!==user.id)return;this.invitations.update(items=>[data as TeamInvitation,...items]);return { invitation:data as TeamInvitation, url:teamInvitationLink(location.origin,(data as TeamInvitation).id,token) };}
 async accept(invitationId:string,token:string){const {data,error}=await this.auth.client.rpc('accept_taskboard_team_invitation',{invitation_id:invitationId,invitation_token:token});if(error)throw new Error(error.message || 'Acceptation impossible. Réessayez après connexion.');return data as string;}
}
