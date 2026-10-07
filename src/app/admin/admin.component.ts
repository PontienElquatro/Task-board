import { Component, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { IconComponent } from '../shared/icon.component';
import { AvatarComponent } from '../shared/avatar.component';
import { A11yModule } from '@angular/cdk/a11y';

interface AdminUser { id:string; email:string; createdAt:string; lastSignIn:string|null; confirmed:boolean; admin:boolean; updatedAt:string|null; suspended?:boolean; }
interface AuditEvent { id:number; action:string; created_at:string; actor_id:string; target_id?:string|null;reason?:string|null;auth_sync?:string|null; }
interface AdminSnapshot { users:AdminUser[]; total:number; page:number; workspaces:number; events:AuditEvent[]; auditPage?:number;auditTotal?:number;generatedAt?:string; metrics?:{teams:number;sharedProjects:number;pendingInvitations:number;expiredInvitations:number;acceptedInvitations:number}; }

@Component({selector:'app-admin',standalone:true,imports:[CommonModule,FormsModule,RouterLink,IconComponent,AvatarComponent,A11yModule],templateUrl:'./admin.component.html'})
export class AdminComponent {
  readonly auth=inject(AuthService);
  readonly snapshot=signal<AdminSnapshot|null>(null);
  readonly loading=signal(false);
  readonly error=signal('');
  search='';
  userPage=1;
  pendingAccount:AdminUser|null=null;
  actionReason='';
  readonly actionBusy=signal(false);
  readonly actionError=signal('');
  section='overview';
  roleFilter='';confirmationFilter='';syncFilter='';auditSearch='';sort='recent';selectedUser:AdminUser|null=null;notice='';
  readonly sections=[{id:'overview',label:'Vue d’ensemble',icon:'chart'},{id:'users',label:'Utilisateurs',icon:'user'},{id:'collaboration',label:'Collaboration',icon:'team'},{id:'audit',label:'Journal',icon:'shield'},{id:'settings',label:'Paramètres',icon:'settings'}];
  private generation=0;
  constructor() {
    effect(() => {
      const user=this.auth.user();
      const initializing=this.auth.initializing();
      untracked(() => {
        this.generation++; this.snapshot.set(null); this.error.set(''); this.search=''; this.selectedUser=null;this.notice=''; this.loading.set(false);this.pendingAccount=null;this.actionReason='';this.actionError.set('');
        if (!initializing && user) void this.load(1);
      });
    });
  }
  matchingUsers() {
    const query=this.search.trim().toLocaleLowerCase();
    return (this.snapshot()?.users??[]).filter(u=>(u.email.toLocaleLowerCase().includes(query)||u.id.includes(query))&&(!this.roleFilter||(this.roleFilter==='admin'?u.admin:!u.admin))&&(!this.confirmationFilter||(this.confirmationFilter==='confirmed'?u.confirmed:!u.confirmed))&&(!this.syncFilter||(this.syncFilter==='cloud'?!!u.updatedAt:!u.updatedAt))).sort((a,b)=>this.sort==='email'?a.email.localeCompare(b.email):this.sort==='activity'?(b.lastSignIn??'').localeCompare(a.lastSignIn??''):b.createdAt.localeCompare(a.createdAt));
  }
  filteredUsers(){return this.matchingUsers().slice((this.userPage-1)*50,this.userPage*50);}
  pageCount(){return Math.max(1,Math.ceil(this.matchingUsers().length/50));}
  auditPageCount(){return Math.max(1,Math.ceil((this.snapshot()?.auditTotal??0)/30));}
  filtersChanged(){this.userPage=1;this.selectedUser=null;}
  confirmedCount(){return this.snapshot()?.users.filter(u=>u.confirmed).length??0;}
  activeCount(){const cutoff=Date.now()-30*86400000;return this.snapshot()?.users.filter(u=>u.lastSignIn&&new Date(u.lastSignIn).getTime()>=cutoff).length??0;}
  auditEvents(){const q=this.auditSearch.trim().toLowerCase();return this.snapshot()?.events.filter(e=>(e.actor_id+' '+this.actorLabel(e.actor_id)+' '+e.action+' '+(e.target_id?this.actorLabel(e.target_id):'')+' '+(e.reason??'')).toLowerCase().includes(q))??[];}
  actorLabel(id:string){return this.snapshot()?.users.find(u=>u.id===id)?.email??id;}
  resetFilters(){this.search='';this.roleFilter='';this.confirmationFilter='';this.syncFilter='';this.filtersChanged();}
  async copyId(id:string){try{await navigator.clipboard.writeText(id);this.notice='Identifiant copié.';}catch{this.notice='Copie indisponible. Sélectionnez l’identifiant dans la fiche.';}}
  requestAccountAction(user:AdminUser){
    if(user.admin||user.id===this.auth.user()?.id)return;
    this.pendingAccount=user;this.actionReason='';this.actionError.set('');
  }
  async confirmAccountAction(){
    const target=this.pendingAccount;
    if(!target||this.actionBusy()||this.actionReason.trim().length<10||this.actionReason.trim().length>500)return;
    const actor=this.auth.user()?.id;if(!actor)return;
    const generation=this.generation;
    this.actionBusy.set(true);this.actionError.set('');
    try{
      const {data,error}=await this.auth.client.functions.invoke('taskboard-admin',{body:{
        action:target.suspended?'reactivate':'suspend',targetId:target.id,
        expectedSuspended:!!target.suspended,reason:this.actionReason.trim()
      }});
      if(this.auth.user()?.id!==actor||generation!==this.generation)return;
      if(error||!data||data.error)throw new Error('Action refusée ou service indisponible. Actualisez avant de réessayer.');
      this.notice=data.warning||(data.suspended?'Compte suspendu. Données conservées.':'Compte réactivé.');
      this.pendingAccount=null;this.actionReason='';await this.load(1,1);
    }catch(error){if(this.auth.user()?.id===actor&&generation===this.generation)this.actionError.set(error instanceof Error?error.message:'Action impossible.');}
    finally{this.actionBusy.set(false);}
  }
  exportAudit(){
    const rows=[['Date UTC','Action','Administrateur','Compte concerné','Motif','Synchronisation Auth'],...this.auditEvents().map(e=>[e.created_at,e.action,this.actorLabel(e.actor_id),e.target_id?this.actorLabel(e.target_id):'',e.reason??'',e.auth_sync??''])];
    const csv=rows.map(row=>row.map(value=>'"'+value.replace(/"/g,'""').replace(/^[\s\u0000-\u001f]*[=+@-]/,prefix=>"'"+prefix)+'"').join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='maat-journal-admin.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async load(page=1,auditPage=this.snapshot()?.auditPage??1) {
    if (!this.auth.user()) return;
    const generation=++this.generation;
    this.loading.set(true); this.error.set('');
    try {
      const {data,error}=await this.auth.client.functions.invoke('taskboard-admin',{body:{page,auditPage}});
      if (generation!==this.generation) return;
      if (error || !data || data.error) throw new Error('Accès réservé aux administrateurs confirmés. Si vous êtes autorisé, vérifiez votre connexion puis réessayez.');
      this.snapshot.set(data);
      this.filtersChanged();
      this.auth.adminAccess.set(true);
    } catch (error) {
      if (generation===this.generation) { this.snapshot.set(null); this.error.set(error instanceof Error ? error.message : 'Service indisponible.'); }
    } finally { if (generation===this.generation) this.loading.set(false); }
  }
}
