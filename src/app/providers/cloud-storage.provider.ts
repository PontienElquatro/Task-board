import { Injectable, inject, signal, effect, untracked } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { StorageProvider } from './storage.provider';

type Envelope = {revision:number; data:Record<string,unknown>; pending:boolean};
@Injectable({providedIn:'root'})
export class CloudStorageProvider implements StorageProvider {
  readonly auth = inject(AuthService);
  readonly contextVersion = signal(0);
  readonly ready = signal(false);
  readonly status = signal('Initialisation…');
  readonly conflict = signal(false);
  private userId: string | null = null;
  private envelope: Envelope = {revision:0,data:{},pending:false};
  private generation = 0;
  private flushing = false;
  private initialized = false;
  private timer?: ReturnType<typeof setTimeout>;
  constructor() {
    effect(() => {
      if (this.auth.initializing()) return;
      const id = this.auth.user()?.id ?? null;
      if (this.initialized && id === this.userId) return;
      this.initialized = true;
      untracked(() => void this.switchAccount(id));
    });
    window.addEventListener('online', () => void this.sync());
    window.addEventListener('focus', () => { if (!document.querySelector('[role=dialog]')) void this.sync(); });
  }
  private cacheKey(id: string) { return 'mytaskboard_cloud_' + id; }
  private persist() { if (this.userId) localStorage.setItem(this.cacheKey(this.userId), JSON.stringify(this.envelope)); }
  private async switchAccount(id: string | null) {
    const generation = ++this.generation;
    clearTimeout(this.timer);
    this.ready.set(false); this.conflict.set(false); this.userId = id;
    this.envelope = {revision:0,data:{},pending:false};
    this.contextVersion.update(v => v + 1);
    if (!id) { this.ready.set(true); this.status.set('Mode local'); return; }
    try {
      const raw = localStorage.getItem(this.cacheKey(id));
      if (raw) {
        const saved = JSON.parse(raw);
        if (!Number.isSafeInteger(saved.revision) || !saved.data || typeof saved.data !== 'object' || Array.isArray(saved.data)) throw new Error('Cache invalide');
        this.envelope = saved;
        this.contextVersion.update(v => v + 1);
      }
      this.status.set('Chargement du cloud…');
      await this.sync(generation);
    } catch { if (generation === this.generation) this.status.set('Cache illisible. Ne supprimez pas vos données ; exportez une copie avant récupération.'); }
  }
  getItem<T>(key: string): T | null {
    if (this.auth.initializing()) return null;
    if (!this.userId) { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
    const value = this.envelope.data[key];
    return value === undefined ? null : JSON.parse(JSON.stringify(value));
  }
  setItem<T>(key: string, value: T): void {
    if (!this.ready() || this.conflict()) throw new Error('Synchronisation non prête ou conflit à résoudre.');
    if (!this.userId) { localStorage.setItem(key, JSON.stringify(value)); return; }
    const previous = this.envelope;
    this.envelope = {...previous, data:{...previous.data, [key]:JSON.parse(JSON.stringify(value))}, pending:true};
    try { this.persist(); } catch (error) { this.envelope = previous; throw error; }
    this.status.set('Enregistré sur cet appareil · synchronisation en attente');
    clearTimeout(this.timer); this.timer = setTimeout(() => void this.sync(), 250);
  }
  removeItem(key: string) {
    if (!this.userId) { localStorage.removeItem(key); return; }
    this.setItem(key, null);
  }
  async sync(generation = this.generation) {
    const id = this.userId;
    if (!id || this.flushing || this.conflict()) return;
    this.flushing = true;
    try {
      const {data, error} = await this.auth.client.from('taskboard_workspaces').select('revision,data').eq('user_id',id).maybeSingle();
      if (generation !== this.generation) return;
      if (error) throw error;
      const revision = data?.revision ?? 0;
      if (this.envelope.pending && revision !== this.envelope.revision) {
        this.conflict.set(true); this.status.set('Conflit : une autre version existe dans le cloud. Exportez votre copie avant de recharger.'); this.ready.set(true); return;
      }
      if (!this.envelope.pending) {
        const changed = JSON.stringify(this.envelope.data) !== JSON.stringify(data?.data ?? {});
        this.envelope = {revision,data:data?.data ?? {},pending:false};
        this.persist(); this.ready.set(true);
        if (changed) this.contextVersion.update(v => v + 1);
      }
      while (this.envelope.pending && generation === this.generation) {
        const sent = this.envelope;
        const {data:next, error:writeError} = await this.auth.client.rpc('save_taskboard_workspace_for_user', {workspace_user:id, expected_revision:sent.revision, workspace_data:sent.data});
        if (generation !== this.generation) return;
        if (writeError) {
          if (writeError.code === '40001') { this.conflict.set(true); this.status.set('Conflit : exportez votre copie, puis rechargez le cloud.'); return; }
          throw writeError;
        }
        this.envelope = {...this.envelope,revision:next,pending:this.envelope !== sent};
        this.persist();
      }
      this.ready.set(true); this.status.set('Synchronisé avec votre compte');
    } catch {
      if (generation === this.generation) {
        // Cached cloud state remains usable offline; a first-time load must succeed.
        this.ready.set(this.envelope.revision > 0 || this.envelope.pending);
        this.status.set(this.envelope.pending ? 'Modifications conservées sur cet appareil · réessayer la synchronisation' : 'Cloud indisponible · réessayer');
      }
    } finally {
      this.flushing = false;
      if (generation !== this.generation) void this.sync();
    }
  }
  async reloadCloud() {
    if (!confirm('Rechargez le cloud uniquement après avoir exporté votre copie. Les modifications locales non synchronisées seront remplacées. Continuer ?')) return;
    this.envelope = {...this.envelope,pending:false}; this.conflict.set(false);
    await this.sync();
  }
}
