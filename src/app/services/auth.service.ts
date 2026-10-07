import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { createClient, User } from '@supabase/supabase-js';
import { PUBLIC_BACKEND } from '../core/config/app-config';
import { profileName, profileInitials, profileNames } from '../core/profile';
import { tabSessionOptions } from '../core/auth/tab-session';

@Injectable({providedIn:'root'})
export class AuthService {
  readonly client = createClient(PUBLIC_BACKEND.url, PUBLIC_BACKEND.publishableKey, {
    auth: tabSessionOptions('maat-auth-' + new URL(PUBLIC_BACKEND.url).hostname, this.tabStorage())
  });
  readonly user = signal<User | null>(null);
  readonly initializing = signal(true);
  readonly recovering = signal(false);
  readonly adminAccess = signal(false);
  readonly sessionError = signal('');
  readonly displayName = computed(() => profileName(this.user()?.user_metadata, this.user() ? 'Mon compte' : 'Espace local'));
  readonly initials = computed(() => profileInitials(this.displayName()));
  readonly avatarUrl = computed(() => {
    const value = this.user()?.user_metadata?.['avatar_url'];
    return typeof value === 'string' && value ? value : '';
  });
  private readonly router = inject(Router);
  private tabStorage(): Storage | undefined {
    try { return typeof window === 'undefined' ? undefined : window.sessionStorage; }
    catch { return undefined; }
  }
  constructor() {
    let authEventReceived = false;
    this.client.auth.onAuthStateChange((event, session) => {
      authEventReceived = true;
      const accountChanged=this.user()?.id!==session?.user?.id;
      this.user.set(session?.user ?? null);
      if(accountChanged || !session) this.adminAccess.set(false);
      if(session && (accountChanged || event==='INITIAL_SESSION')) setTimeout(()=>void this.isAdmin(),0);
      this.sessionError.set('');
      this.initializing.set(false);
      if (event === 'PASSWORD_RECOVERY') {
        this.recovering.set(true);
        queueMicrotask(() => this.router.navigate(['/login'], {queryParams:{mode:'recovery'}}));
      }
    });
    // Explicitly restore the persisted session as well as listening for future events.
    // A late initial read must never overwrite a newer sign-in/sign-out event.
    void this.client.auth.getSession().then(({data, error}) => {
      if (authEventReceived) return;
      if (error) { this.sessionError.set('Session indisponible. Rechargez la page avant de modifier vos tâches.'); return; }
      this.user.set(data.session?.user ?? null);
      if(data.session) void this.isAdmin();
      this.initializing.set(false);
    }).catch(() => {
      if (!authEventReceived) this.sessionError.set('Session indisponible. Rechargez la page avant de modifier vos tâches.');
    });
  }
  async signIn(email: string, password: string) {
    const {error} = await this.client.auth.signInWithPassword({email, password});
    if (error) throw new Error('Connexion impossible. Vérifiez vos identifiants et la confirmation de votre adresse email.');
  }
  async signUp(email: string, password: string, firstName:string, lastName:string) {
    const {error} = await this.client.auth.signUp({email, password, options:{data:profileNames(firstName,lastName),emailRedirectTo:location.origin + '/login'}});
    if (error) throw new Error('Inscription impossible : ' + error.message);
  }
  async resetPassword(email: string) {
    const {error} = await this.client.auth.resetPasswordForEmail(email, {redirectTo:location.origin + '/login?mode=recovery'});
    if (error) throw new Error('Envoi impossible. Réessayez plus tard.');
  }
  async changePassword(password: string) {
    const {error} = await this.client.auth.updateUser({password});
    if (error) throw new Error('Modification du mot de passe impossible.');
    this.recovering.set(false);
  }

  async isAdmin() {
    if (!this.user()) return false;
    const accountId=this.user()!.id;
    try {
      const {data,error}=await this.client.functions.invoke('taskboard-admin',{body:{page:1}});
      if(this.user()?.id!==accountId) return false;
      const allowed=!error && !!data && !data.error;
      this.adminAccess.set(allowed);
      return allowed;
    } catch {
      if(this.user()?.id===accountId) this.adminAccess.set(false);
      return false;
    }
  }
  async updateProfile(input: { displayName?: string; firstName?:string; lastName?:string; email?: string; avatarUrl?: string | null }) {
    const displayName = input.displayName?.trim();
    const email = input.email?.trim().toLowerCase();
    const nameData=(input.firstName?.trim() || input.lastName?.trim()) ? profileNames(input.firstName||'',input.lastName||'') : displayName ? {full_name:displayName,name:displayName} : {};
    const metadata={...this.user()?.user_metadata,...nameData,...(input.avatarUrl!==undefined ? {avatar_url:input.avatarUrl} : {})};
    const { data, error } = await this.client.auth.updateUser({
      ...((Object.keys(nameData).length || input.avatarUrl!==undefined) ? {data:metadata} : {}),
      ...(email ? { email } : {})
    });
    if (error) throw new Error('Mise à jour du profil impossible : ' + error.message);
    if (data.user) this.user.set(data.user);
  }
  async uploadAvatar(file: File) {
    const user = this.user();
    if (!user) throw new Error('Connectez-vous pour ajouter une photo.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Utilisez une image JPG, PNG ou WebP.');
    if (file.size > 2 * 1024 * 1024) throw new Error('La photo doit faire moins de 2 Mo.');
    const extension = file.type.split('/')[1].replace('jpeg', 'jpg');
    const path = `${user.id}/avatar.${extension}`;
    const { error: uploadError } = await this.client.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
    if (uploadError) throw new Error('Import de la photo impossible : ' + uploadError.message);
    const { data } = this.client.storage.from('avatars').getPublicUrl(path);
    await this.updateProfile({ avatarUrl: `${data.publicUrl}?v=${Date.now()}` });
  }
  async removeAvatar() {
    const user = this.user();
    if (!user) return;
    const { error } = await this.client.auth.updateUser({ data: { avatar_url: null } });
    if (error) throw new Error('Suppression de la photo impossible.');
    this.user.set({ ...user, user_metadata: { ...user.user_metadata, avatar_url: null } });
  }
  async signOut() {
    const {error} = await this.client.auth.signOut({ scope: 'local' });
    if (error) throw new Error('Déconnexion impossible. Réessayez.');
  }
}
