import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
export type TeamRole='owner'|'admin'|'member'|'viewer';
export interface Team{id:string;owner_id:string;name:string;created_at:string;}
export interface TeamInvitation{id:string;team_id:string;email:string;role:Exclude<TeamRole,'owner'>;expires_at:string;created_at:string;accepted_at?:string|null;}
@Injectable({providedIn:'root'}) export class TeamService{
 private readonly auth=inject(AuthService); readonly teams=signal<Team[]>([]); readonly invitations=signal<TeamInvitation[]>([]); readonly members=signal<{team_id:string;user_id:string;role:TeamRole;display_name:string}[]>([]);
 async load(){
 const account=this.auth.user()?.id;
 this.teams.set([]);this.members.set([]);this.invitations.set([]);
 if(!account)return;
 const result=await this.auth.client.from('taskboard_teams').select('*').order('created_at',{ascending:false});
 if(result.error)throw new Error('Chargement des équipes impossible.');
 const roster=await this.auth.client.rpc('taskboard_team_roster');
 if(roster.error)throw new Error('Chargement des membres impossible : '+roster.error.message);
 const ids=(result.data??[]).map((x:{id:string})=>x.id);
 const invites=ids.length?await this.auth.client.from('taskboard_team_invitations').select('id,team_id,email,role,expires_at,created_at,accepted_at').in('team_id',ids).order('created_at',{ascending:false}):{data:[],error:null};
 if(invites.error)throw new Error('Chargement des invitations impossible.');
 if(this.auth.user()?.id!==account)return;
 this.teams.set((result.data??[]) as Team[]);this.members.set(roster.data??[]);this.invitations.set((invites.data??[]) as TeamInvitation[]);
 }
 role(team:Team):TeamRole|undefined{return team.owner_id===this.auth.user()?.id?'owner':this.members().find(m=>m.team_id===team.id&&m.user_id===this.auth.user()?.id)?.role;}
 canManage(team:Team){return team.owner_id===this.auth.user()?.id;}
 roleLabel(role:string|undefined){return ({owner:'Propriétaire',admin:'Administrateur',member:'Membre',viewer:'Lecteur'} as Record<string,string>)[role??'']??'Membre';}
 status(invitation:TeamInvitation){return invitation.accepted_at?'Acceptée':new Date(invitation.expires_at).getTime()<=Date.now()?'Expirée':'En attente';}
 async cancel(id:string){const {error}=await this.auth.client.rpc('cancel_taskboard_invitation',{invitation_id:id});if(error)throw new Error(error.message);this.invitations.update(items=>items.filter(i=>i.id!==id));}

 async create(name:string){const user=this.auth.user(),clean=name.trim();if(!user)throw new Error('Connectez-vous pour créer une équipe.');if(clean.length<2)throw new Error('Donnez un nom à votre équipe.');const {data,error}=await this.auth.client.from('taskboard_teams').insert({owner_id:user.id,name:clean}).select().single();if(error)throw new Error('Création impossible : '+error.message);const team=data as Team;const member=await this.auth.client.from('taskboard_team_members').insert({team_id:team.id,user_id:user.id,role:'owner'});if(member.error)throw new Error('Équipe créée mais propriétaire non enregistré.');this.teams.update(items=>[team,...items]);}
 async invite(teamId:string,email:string,role:Exclude<TeamRole,'owner'>){const user=this.auth.user(),clean=email.trim().toLowerCase();if(!user)throw new Error('Connectez-vous pour inviter un membre.');if(!/^\S+@\S+\.\S+$/.test(clean))throw new Error('Adresse email invalide.');const token=crypto.randomUUID()+crypto.randomUUID();const {data,error}=await this.auth.client.from('taskboard_team_invitations').insert({team_id:teamId,email:clean,role,invited_by:user.id,token_hash:token}).select('id,team_id,email,role,expires_at,created_at').single();if(error)throw new Error('Invitation impossible : '+error.message);const team=this.teams().find(item=>item.id===teamId);const mail=await this.auth.client.functions.invoke('send-team-invitation',{body:{invitationId:(data as TeamInvitation).id,token,teamName:team?.name,appUrl:location.origin}});const detail=(mail.data as {error?:string;sent?:boolean}|null)?.error;if(mail.error||mail.data?.sent!==true){await this.auth.client.from('taskboard_team_invitations').delete().eq('id',(data as TeamInvitation).id);throw new Error('Invitation enregistrée mais email non envoyé : '+(detail||(mail.error?.message??'Réponse invalide du service email')));}this.invitations.update(items=>[data as TeamInvitation,...items]);}
 async accept(invitationId:string,token:string){const {data,error}=await this.auth.client.rpc('accept_taskboard_team_invitation',{invitation_id:invitationId,invitation_token:token});if(error)throw new Error(error.message || 'Acceptation impossible. Réessayez après connexion.');return data as string;}
}
