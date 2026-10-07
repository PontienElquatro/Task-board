import { Component, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { BrandComponent } from '../shared/brand/brand.component';

interface AdminUser { id:string; email:string; createdAt:string; lastSignIn:string|null; confirmed:boolean; admin:boolean; updatedAt:string|null; }
interface AuditEvent { id:number; action:string; created_at:string; actor_id:string; }
interface AdminSnapshot { users:AdminUser[]; total:number; page:number; workspaces:number; events:AuditEvent[]; }

@Component({selector:'app-admin',standalone:true,imports:[CommonModule,FormsModule,RouterLink,BrandComponent],templateUrl:'./admin.component.html',styleUrl:'./admin.component.css'})
export class AdminComponent {
  readonly auth=inject(AuthService);
  readonly snapshot=signal<AdminSnapshot|null>(null);
  readonly loading=signal(false);
  readonly error=signal('');
  search='';
  section='overview';
  readonly sections=[{id:'overview',label:'Vue d’ensemble'},{id:'users',label:'Utilisateurs'},{id:'audit',label:'Journal'},{id:'settings',label:'Paramètres'}];
  private generation=0;
  constructor() {
    effect(() => {
      const user=this.auth.user();
      const initializing=this.auth.initializing();
      untracked(() => {
        this.generation++; this.snapshot.set(null); this.error.set(''); this.search=''; this.loading.set(false);
        if (!initializing && user) void this.load(1);
      });
    });
  }
  filteredUsers() { const query=this.search.toLocaleLowerCase(); return (this.snapshot()?.users ?? []).filter(user => user.email.toLocaleLowerCase().includes(query)); }
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
