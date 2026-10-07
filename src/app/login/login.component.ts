import { UiFieldDirective } from '../shared/ui-field.directive';
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CloudStorageProvider } from '../providers/cloud-storage.provider';
import { normalizeTasks } from '../models/task-utils';
import { BrandComponent } from '../shared/brand/brand.component';
import { IconComponent } from '../shared/icon.component';
@Component({selector:'app-login',standalone:true,imports:[UiFieldDirective,CommonModule,FormsModule,RouterLink,BrandComponent,IconComponent],templateUrl:'./login.component.html'})
export class LoginComponent {
  readonly auth=inject(AuthService);
  readonly cloud=inject(CloudStorageProvider);
  private readonly router=inject(Router);
  private readonly route=inject(ActivatedRoute);
  mode: 'login'|'signup'|'reset'|'recovery' = this.route.snapshot.queryParamMap.get('mode') === 'recovery' ? 'recovery' : 'login';
  firstName='';lastName='';email=''; password=''; confirmation='';
  showPassword=false;showConfirmation=false;
  readonly busy=signal(false); readonly message=signal(''); readonly error=signal('');
  setMode(mode: 'login'|'signup'|'reset'|'recovery') { this.mode=mode; this.password=''; this.confirmation=''; this.showPassword=false;this.showConfirmation=false; this.error.set(''); this.message.set(''); }
  async submit() {
    if(this.busy()) return;
    this.error.set(''); this.message.set(''); this.busy.set(true);
    try {
      if(this.mode==='login') { await this.auth.signIn(this.email.trim(),this.password); await this.router.navigate([await this.auth.isAdmin()?'/admin':'/board']); }
      if(this.mode==='signup') { if(this.password!==this.confirmation) throw new Error('Les mots de passe diffèrent.'); await this.auth.signUp(this.email.trim(),this.password,this.firstName,this.lastName); this.message.set('Vérifiez votre boîte email pour confirmer votre inscription.'); this.password=''; this.confirmation=''; }
      if(this.mode==='reset') { await this.auth.resetPassword(this.email.trim()); this.message.set('Si cette adresse est enregistrée, un lien de récupération sera envoyé.'); }
      if(this.mode==='recovery') { if(this.password!==this.confirmation) throw new Error('Les mots de passe diffèrent.'); await this.auth.changePassword(this.password); this.password=''; this.confirmation=''; this.message.set('Mot de passe modifié.'); this.mode='login'; }
    } catch(error) { this.error.set(error instanceof Error ? error.message : 'Service indisponible.'); }
    finally { this.busy.set(false); }
  }
  async signOut() { this.busy.set(true); try { await this.auth.signOut(); await this.router.navigate(['/board']); } catch(error) {this.error.set(error instanceof Error ? error.message : 'Déconnexion impossible.');} finally {this.busy.set(false);} }
  importLocal() {
    this.error.set('');
    try {
      const local=normalizeTasks(JSON.parse(localStorage.getItem('mytaskboard_tasks') ?? '[]'));
      const current=normalizeTasks(this.cloud.getItem('mytaskboard_tasks') ?? []);
      const ids=new Set(current.map(t=>t.id));
      const additions=local.filter(t=>!ids.has(t.id));
      if(current.length+additions.length>10000) throw new Error('Maximum 10 000 tâches.');
      this.cloud.setItem('mytaskboard_tasks',[...current,...additions]);
      this.cloud.contextVersion.update(v=>v+1);
      this.message.set(additions.length+' tâche(s) locale(s) ajoutée(s). La copie locale originale est conservée ; vérifiez l’état de synchronisation.');
    } catch(error) {this.error.set(error instanceof Error ? error.message : 'Migration impossible.');}
  }
}
