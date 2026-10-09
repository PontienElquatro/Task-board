import { Component, DestroyRef, PLATFORM_ID, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AuthService } from '../services/auth.service';

interface Preferences { assignments: boolean; completions: boolean; }
const defaults = (): Preferences => ({ assignments: true, completions: true });

@Component({ standalone: true, selector: 'app-notification-preferences', imports: [CommonModule], template: `
<article class="rounded-2xl border border-blue-100 bg-white p-6 dark:border-indigo-900 dark:bg-gray-900" [attr.aria-busy]="loading() || saving()">
  <h2 class="text-lg font-semibold">Mes notifications</h2>
  <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">Choisissez les notifications de collaboration à recevoir dans la cloche. Vos choix suivent votre compte sur tous vos appareils.</p>
  <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">Ils concernent les prochaines notifications, sans supprimer votre historique. Les emails d’invitation et de sécurité ne sont pas modifiés.</p>
  <p *ngIf="!auth.user()" class="mt-4 text-sm">Connectez-vous pour gérer vos préférences.</p>
  <p *ngIf="loading()" role="status" class="mt-4 text-sm">Chargement des préférences…</p>
  <p *ngIf="error()" role="alert" class="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{{error()}}</p>
  <button *ngIf="auth.user() && !loaded() && !loading()" type="button" class="secondary mt-3 min-h-11" (click)="load()">Réessayer</button>
  <fieldset class="mt-6 grid gap-3" [disabled]="!loaded() || loading() || saving() || !auth.user()">
    <legend class="sr-only">Notifications de collaboration</legend>
    <label class="flex min-h-16 cursor-pointer items-center justify-between gap-4 rounded-xl border border-blue-100 p-4 dark:border-indigo-900">
      <span><span class="block font-semibold">Assignations reçues</span><span class="mt-1 block text-sm text-gray-600 dark:text-gray-300">Quand une tâche ou sous-tâche vous est attribuée.</span></span>
      <input type="checkbox" class="h-5 w-5 shrink-0 accent-blue-600" [checked]="draft().assignments" (change)="change('assignments', $event)" />
    </label>
    <label class="flex min-h-16 cursor-pointer items-center justify-between gap-4 rounded-xl border border-blue-100 p-4 dark:border-indigo-900">
      <span><span class="block font-semibold">Travail terminé</span><span class="mt-1 block text-sm text-gray-600 dark:text-gray-300">Quand un membre termine un travail que vous lui avez confié, ou dont vous êtes le destinataire.</span></span>
      <input type="checkbox" class="h-5 w-5 shrink-0 accent-blue-600" [checked]="draft().completions" (change)="change('completions', $event)" />
    </label>
  </fieldset>
  <div class="mt-5 flex flex-wrap gap-3">
    <button type="button" class="primary min-h-11 disabled:opacity-50" [disabled]="!loaded() || saving() || !dirty()" (click)="save()">{{saving() ? 'Enregistrement…' : 'Enregistrer mes préférences'}}</button>
    <button type="button" class="secondary min-h-11" [disabled]="!loaded() || saving() || !dirty()" (click)="cancel()">Annuler les changements</button>
  </div>
  <p *ngIf="success()" role="status" class="mt-4 text-sm text-emerald-700 dark:text-emerald-300">{{success()}}</p>
</article>` })
export class NotificationPreferencesComponent {
  readonly auth = inject(AuthService);
  readonly draft = signal<Preferences>(defaults());
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly loaded = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  private saved = defaults();
  private epoch = 0;
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  constructor() {
    inject(DestroyRef).onDestroy(() => { this.epoch++; });
    effect(() => {
      const id = this.auth.user()?.id;
      untracked(() => {
        this.epoch++;
        this.loaded.set(false); this.loading.set(false); this.saving.set(false);
        this.error.set(''); this.success.set(''); this.saved = defaults(); this.draft.set(defaults());
        if (id && this.browser) void this.load();
      });
    });
  }
  dirty() { return this.draft().assignments !== this.saved.assignments || this.draft().completions !== this.saved.completions; }
  change(key: keyof Preferences, event: Event) {
    this.draft.update(value => ({ ...value, [key]: (event.target as HTMLInputElement).checked }));
    this.success.set('');
  }
  cancel() { this.draft.set({ ...this.saved }); this.success.set(''); this.error.set(''); }
  async load() {
    const id = this.auth.user()?.id;
    if (!id || this.loading() || this.saving()) return;
    const epoch = ++this.epoch;
    this.loading.set(true); this.loaded.set(false); this.error.set('');
    try {
      const { data, error } = await this.auth.client.from('taskboard_notification_preferences').select('assignments,completions').eq('user_id', id).maybeSingle();
      if (error) throw error;
      if (epoch !== this.epoch || id !== this.auth.user()?.id) return;
      this.saved = data ? { assignments: data.assignments, completions: data.completions } : defaults();
      this.draft.set({ ...this.saved }); this.loaded.set(true);
    } catch {
      if (epoch === this.epoch && id === this.auth.user()?.id) this.error.set('Préférences indisponibles. Réessayez avant de modifier vos choix.');
    } finally { if (epoch === this.epoch) this.loading.set(false); }
  }
  async save() {
    const id = this.auth.user()?.id;
    if (!id || !this.loaded() || this.saving() || !this.dirty()) return;
    const epoch = this.epoch, snapshot = { ...this.draft() };
    this.saving.set(true); this.error.set(''); this.success.set('');
    try {
      const { data, error } = await this.auth.client.from('taskboard_notification_preferences').upsert({ user_id: id, ...snapshot }, { onConflict: 'user_id' }).select('assignments,completions').single();
      if (error || !data) throw error ?? new Error('Missing saved row');
      if (epoch !== this.epoch || id !== this.auth.user()?.id) return;
      this.saved = { assignments: data.assignments, completions: data.completions };
      this.draft.set({ ...this.saved }); this.success.set('Préférences enregistrées pour votre compte.');
    } catch {
      if (epoch === this.epoch && id === this.auth.user()?.id) this.error.set('Enregistrement impossible. Vos changements ne sont pas confirmés ; vous pouvez réessayer.');
    } finally { if (epoch === this.epoch) this.saving.set(false); }
  }
}
