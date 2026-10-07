import { Component, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { IconComponent } from '../shared/icon.component';
import { AvatarComponent } from '../shared/avatar.component';

interface AdminUser { id:string; email:string; createdAt:string; lastSignIn:string|null; confirmed:boolean; admin:boolean; updatedAt:string|null; }
interface AuditEvent { id:number; action:string; created_at:string; actor_id:string; }
interface AdminSnapshot { users:AdminUser[]; total:number; page:number; workspaces:number; events:AuditEvent[]; generatedAt?:string; metrics?:{teams:number;sharedProjects:number;pendingInvitations:number;expiredInvitations:number;acceptedInvitations:number}; }

@Component({selector:'app-admin',standalone:true,imports:[CommonModule,FormsModule,RouterLink,IconComponent,AvatarComponent],templateUrl:'./admin.component.html'})
export class AdminComponent {
  readonly auth=inject(AuthService);
  readonly snapshot=signal<AdminSnapshot|null>(null);
  readonly loading=signal(false);
  readonly error=signal('');
  search='';
  section='overview';
  roleFilter='';confirmationFilter='';syncFilter='';auditSearch='';sort='recent';selectedUser:AdminUser|null=null;notice='';
  readonly sections=[{id:'overview',label:'Vue d’ensemble',icon:'chart'},{id:'users',label:'Utilisateurs',icon:'user'},{id:'collaboration',label:'Collaboration',icon:'team'},{id:'audit',label:'Journal',icon:'shield'},{id:'settings',label:'Paramètres',icon:'settings'}];
  private generation=0;
  constructor() {
    effect(() => {
      const user=this.auth.user();
      const initializing=this.auth.initializing();
      untracked(() => {
        this.generation++; this.snapshot.set(null); this.error.set(''); this.search=''; this.selectedUser=null;this.notice=''; this.loading.set(false);
        if (!initializing && user) void this.load(1);
      });
    });
  }
  filteredUsers() {
    const query=this.search.trim().toLocaleLowerCase();
    return (this.snapshot()?.users??[]).filter(u=>(u.email.toLocaleLowerCase().includes(query)||u.id.includes(query))&&(!this.roleFilter||(this.roleFilter==='admin'?u.admin:!u.admin))&&(!this.confirmationFilter||(this.confirmationFilter==='confirmed'?u.confirmed:!u.confirmed))&&(!this.syncFilter||(this.syncFilter==='cloud'?!!u.updatedAt:!u.updatedAt))).sort((a,b)=>this.sort==='email'?a.email.localeCompare(b.email):this.sort==='activity'?(b.lastSignIn??'').localeCompare(a.lastSignIn??''):b.createdAt.localeCompare(a.createdAt));
  }
  pageCount(){return Math.max(1,Math.ceil((this.snapshot()?.total??0)/50));}
  confirmedCount(){return this.snapshot()?.users.filter(u=>u.confirmed).length??0;}
  activeCount(){const cutoff=Date.now()-30*86400000;return this.snapshot()?.users.filter(u=>u.lastSignIn&&new Date(u.lastSignIn).getTime()>=cutoff).length??0;}
  auditEvents(){const q=this.auditSearch.trim().toLowerCase();return this.snapshot()?.events.filter(e=>(e.actor_id+' '+this.actorLabel(e.actor_id)+' '+e.action).toLowerCase().includes(q))??[];}
  actorLabel(id:string){return this.snapshot()?.users.find(u=>u.id===id)?.email??id;}
  resetFilters(){this.search='';this.roleFilter='';this.confirmationFilter='';this.syncFilter='';}
  async copyId(id:string){try{await navigator.clipboard.writeText(id);this.notice='Identifiant copié.';}catch{this.notice='Copie indisponible. Sélectionnez l’identifiant dans la fiche.';}}
  exportAudit(){
    const rows=[['Date UTC','Action','Compte'],...this.auditEvents().map(e=>[e.created_at,e.action,this.actorLabel(e.actor_id)])];
    const csv=rows.map(row=>row.map(value=>'"'+value.replace(/"/g,'""').replace(/^[=+@-]/,"'"+value.charAt(0))+'"').join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='maat-journal-admin.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async load(page=1) {
    if (!this.auth.user()) return;
    const generation=++this.generation;
    this.loading.set(true); this.error.set('');
    try {
      const {data,error}=await this.auth.client.functions.invoke('taskboard-admin',{body:{page}});
      if (generation!==this.generation) return;
      if (error || !data || data.error) throw new Error('Accès réservé aux administrateurs confirmés. Si vous êtes autorisé, vérifiez votre connexion puis réessayez.');
      this.snapshot.set(data);
      this.auth.adminAccess.set(true);
    } catch (error) {
      if (generation===this.generation) { this.snapshot.set(null); this.error.set(error instanceof Error ? error.message : 'Service indisponible.'); }
    } finally { if (generation===this.generation) this.loading.set(false); }
  }
}
