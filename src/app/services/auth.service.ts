import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { createClient, User } from '@supabase/supabase-js';
import { PUBLIC_BACKEND } from '../core/config/app-config';

@Injectable({providedIn:'root'})
export class AuthService {
  readonly client = createClient(PUBLIC_BACKEND.url, PUBLIC_BACKEND.publishableKey);
  readonly user = signal<User | null>(null);
  readonly initializing = signal(true);
  readonly recovering = signal(false);
  readonly sessionError = signal('');
  readonly displayName = computed(() => {
    const user = this.user();
    const name = user?.user_metadata?.['full_name'] ?? user?.user_metadata?.['name'];
    return typeof name === 'string' && name.trim() ? name.trim() : user?.email ?? 'Espace local';
  });
  readonly initials = computed(() => this.displayName().slice(0, 2).toLocaleUpperCase('fr'));
  private readonly router = inject(Router);
  constructor() {
    let authEventReceived = false;
    this.client.auth.onAuthStateChange((event, session) => {
      authEventReceived = true;
      this.user.set(session?.user ?? null);
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
      this.initializing.set(false);
    }).catch(() => {
      if (!authEventReceived) this.sessionError.set('Session indisponible. Rechargez la page avant de modifier vos tâches.');
    });
  }
  async signIn(email: string, password: string) {
    const {error} = await this.client.auth.signInWithPassword({email, password});
    if (error) throw new Error('Connexion impossible. Vérifiez vos identifiants et la confirmation de votre adresse email.');
  }
  async signUp(email: string, password: string) {
    const {error} = await this.client.auth.signUp({email, password, options:{emailRedirectTo:location.origin + '/login'}});
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
  async signOut() {
    const {error} = await this.client.auth.signOut();
    if (error) throw new Error('Déconnexion impossible. Réessayez.');
  }
}
