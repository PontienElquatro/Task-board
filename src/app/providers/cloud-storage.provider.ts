import { Injectable, inject, signal, effect, untracked, DestroyRef } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { StorageProvider } from './storage.provider';
import { saveRecoveryBackup } from '../core/storage/recovery-backup';
import { MergeChoice, MergeConflict, Workspace, WorkspaceMerge, mergeWorkspace, resolveWorkspaceMerge } from '../core/storage/workspace-merge';
import { WorkspaceEnvelope } from '../core/storage/workspace-envelope';
import { DEVICE_CHECKPOINTS } from '../core/storage/indexed-checkpoints';
import { WORKSPACE_LOCKS, validNotice, withWorkspaceLock } from '../core/storage/tab-coordinator';

type Envelope = WorkspaceEnvelope;
@Injectable({providedIn:'root'})
export class CloudStorageProvider implements StorageProvider {
  readonly auth = inject(AuthService);
  readonly contextVersion = signal(0);
  readonly ready = signal(false);
  readonly status = signal('Initialisation…');
  readonly conflict = signal(false);
  readonly conflictItems = signal<MergeConflict[]>([]);
  readonly localBackupStatus = signal('Copie IndexedDB en préparation');
  private readonly checkpoints=inject(DEVICE_CHECKPOINTS);
  private readonly locks=inject(WORKSPACE_LOCKS);
  private readonly writer=crypto.randomUUID();
  private channel?:BroadcastChannel;
  private mirrorQueue:Promise<void>=Promise.resolve();
  private peerTimer?:ReturnType<typeof setTimeout>;
  private readonly localReads=new Map<string,string|null>();
  private remoteConflict?: {revision:number; data:Workspace; merge:WorkspaceMerge};
  private userId: string | null = null;
  private envelope: Envelope = {revision:0,data:{},pending:false};
  private generation = 0;
  private flushing = false;
  private initialized = false;
  private timer?: ReturnType<typeof setTimeout>;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private retryAttempt = 0;
  private destroyed = false;
  constructor() {
    effect(() => {
      if (this.auth.initializing()) return;
      const id = this.auth.user()?.id ?? null;
      if (this.initialized && id === this.userId) return;
      this.initialized = true;
      untracked(() => void this.switchAccount(id));
    });
    const online = () => void this.sync();
    const focus = () => { if (!document.querySelector('[role=dialog]')) void this.sync(); };
    const changed = (event:StorageEvent) => {
      if(event.storageArea && event.storageArea!==localStorage) return;
      if(this.userId && event.key===this.cacheKey(this.userId)) this.schedulePeerRefresh();
      if(!this.userId && ['mytaskboard_tasks','mytaskboard_projects','mytaskboard_goals'].includes(event.key ?? '')) this.schedulePeerRefresh();
    };
    if(typeof BroadcastChannel!=='undefined') {
      this.channel=new BroadcastChannel('maat-sync-notices');
      this.channel.onmessage=event=>{
        if(validNotice(event.data) && event.data.writer!==this.writer && event.data.account===this.userId) this.schedulePeerRefresh();
      };
    }
    window.addEventListener('online', online);
    window.addEventListener('focus', focus);
    window.addEventListener('storage',changed);
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true; clearTimeout(this.timer); clearTimeout(this.retryTimer); clearTimeout(this.peerTimer);
      window.removeEventListener('online', online); window.removeEventListener('focus', focus);
      window.removeEventListener('storage',changed); this.channel?.close();
    });
  }
  private cacheKey(id: string) { return 'mytaskboard_cloud_' + id; }
  private journalKey(id:string) {return this.cacheKey(id)+'_draft_'+this.writer;}
  private mirror(account:string,envelope:Envelope) {
    const snapshot:Envelope=JSON.parse(JSON.stringify(envelope));
    const generation=this.generation;
    this.localBackupStatus.set('Copie IndexedDB en cours');
    this.mirrorQueue=this.mirrorQueue.then(()=>this.checkpoints.put(account,this.writer,snapshot)).then(()=>{
      // Cleanup is optional: a retained journal must not invalidate a successful IndexedDB transaction.
      try {
        if(!snapshot.pending && localStorage.getItem(this.journalKey(account))===JSON.stringify(snapshot)) localStorage.removeItem(this.journalKey(account));
      } catch { /* Keep the extra recovery copy when localStorage is unavailable. */ }
      if(generation===this.generation && !this.destroyed) this.localBackupStatus.set('Copie IndexedDB confirmée');
    }).catch(()=>{
      if(generation===this.generation && !this.destroyed) this.localBackupStatus.set('Copie IndexedDB indisponible · conservez un export');
    });
  }
  private persist() {
    if(this.userId) {
      const raw=JSON.stringify(this.envelope);
      // A separate synchronous journal prevents another tab's shared cache write from destroying this draft.
      localStorage.setItem(this.journalKey(this.userId),raw);
      localStorage.setItem(this.cacheKey(this.userId),raw);
      this.mirror(this.userId,this.envelope);
    }
  }
  private schedulePeerRefresh() {
    if(this.destroyed) return;
    clearTimeout(this.peerTimer);
    this.peerTimer=setTimeout(()=>{
      if(this.destroyed) return;
      if(document.querySelector('[role=dialog]') || this.flushing) {this.schedulePeerRefresh();return;}
      if(this.userId) void this.sync();
      else this.contextVersion.update(v=>v+1);
    },250);
  }
  private async switchAccount(id: string | null) {
    const generation = ++this.generation;
    clearTimeout(this.timer);
    clearTimeout(this.retryTimer); this.retryAttempt = 0;
    clearTimeout(this.peerTimer);
    this.ready.set(false); this.conflict.set(false); this.conflictItems.set([]); this.remoteConflict=undefined; this.userId = id;
    this.envelope = {revision:0,data:{},pending:false};
    this.contextVersion.update(v => v + 1);
    this.localReads.clear();
    if (!id) { this.ready.set(true); this.status.set('Mode local'); this.localBackupStatus.set('Copie IndexedDB créée à la prochaine modification'); return; }
    try {
      let raw = localStorage.getItem(this.cacheKey(id));
      if(!raw) {
        try {
          const copies=await this.checkpoints.list(id);
          if(generation!==this.generation) return;
          const saved=copies.find(copy=>copy.envelope.pending) ?? copies[0];
          if(saved) raw=JSON.stringify(saved.envelope);
        } catch {this.localBackupStatus.set('Copie IndexedDB indisponible · conservez un export');}
      }
      if (raw) {
        const saved = JSON.parse(raw);
        if (!Number.isSafeInteger(saved.revision) || saved.revision < 0 || typeof saved.pending !== 'boolean' ||
          !saved.data || typeof saved.data !== 'object' || Array.isArray(saved.data) ||
          (saved.base !== undefined && (!saved.base || typeof saved.base !== 'object' || Array.isArray(saved.base)))) throw new Error('Cache invalide');
        this.envelope = saved;
        this.contextVersion.update(v => v + 1);
      }
      this.status.set('Chargement du cloud…');
      await this.sync(generation);
    } catch { if (generation === this.generation) this.status.set('Cache illisible. Ne supprimez pas vos données ; exportez une copie avant récupération.'); }
  }
  getItem<T>(key: string): T | null {
    if (this.auth.initializing()) return null;
    if (!this.userId) { const raw = localStorage.getItem(key); this.localReads.set(key,raw); return raw ? JSON.parse(raw) : null; }
    const value = this.envelope.data[key];
    return value === undefined ? null : JSON.parse(JSON.stringify(value));
  }
  setItem<T>(key: string, value: T): void {
    if (!this.ready() || this.conflict()) throw new Error('Synchronisation non prête ou conflit à résoudre.');
    if (!this.userId) {
      const current=localStorage.getItem(key);
      if(this.localReads.has(key) && current!==this.localReads.get(key)) throw new Error('Une autre version a été enregistrée dans un onglet. Votre formulaire est conservé ; fermez-le pour recharger le tableau avant de réessayer.');
      const data:Workspace={};
      for(const storedKey of ['mytaskboard_tasks','mytaskboard_projects','mytaskboard_goals']){
        const raw=localStorage.getItem(storedKey);
        if(raw) data[storedKey]=JSON.parse(raw);
      }
      data[key]=JSON.parse(JSON.stringify(value));
      const snapshot:Envelope={revision:0,data,pending:false};
      localStorage.setItem(this.journalKey('__local__'),JSON.stringify(snapshot));
      const raw=JSON.stringify(value);
      localStorage.setItem(key,raw); this.localReads.set(key,raw);
      this.mirror('__local__',snapshot);
      return;
    }
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
    const id=this.userId;
    if(!id || generation!==this.generation || this.destroyed || this.flushing || this.conflict()) return;
    if(document.querySelector('[role=dialog]')) {this.schedulePeerRefresh();return;}
    try {
      await withWorkspaceLock(id,async()=>{
        if(generation===this.generation && !this.destroyed) await this.performSync(generation);
      },this.locks);
    } catch {
      if(generation===this.generation) this.status.set('Synchronisation différée · verrou navigateur indisponible');
    }
  }
  private async performSync(generation:number) {
    const id = this.userId;
    if (!id || this.flushing || this.conflict() || this.destroyed) return;
    clearTimeout(this.retryTimer);
    this.flushing = true;
    try {
      const {data, error} = await this.auth.client.from('taskboard_workspaces').select('revision,data').eq('user_id',id).maybeSingle();
      if (generation !== this.generation) return;
      if (error) throw error;
      const revision = data?.revision ?? 0;
      if (this.envelope.pending && revision !== this.envelope.revision) {
        if (!this.mergeRemote(revision,data?.data ?? {})) return;
      }
      if (!this.envelope.pending) {
        const changed = JSON.stringify(this.envelope.data) !== JSON.stringify(data?.data ?? {});
        this.envelope = {revision,data:data?.data ?? {},base:data?.data ?? {},pending:false};
        this.persist(); this.ready.set(true);
        if (changed) this.contextVersion.update(v => v + 1);
      }
      while (this.envelope.pending && generation === this.generation) {
        const sent = this.envelope;
        const {data:next, error:writeError} = await this.auth.client.rpc('save_taskboard_workspace_for_user', {workspace_user:id, expected_revision:sent.revision, workspace_data:sent.data});
        if (generation !== this.generation) return;
        if (writeError) {
          if (writeError.code === 'PT409' || writeError.code === '40001') {
            this.status.set('Une autre version vient d’être enregistrée · nouvelle comparaison en cours');
            this.retryTimer=setTimeout(()=>{if(generation===this.generation) void this.sync(generation);},2000);
            return;
          }
          throw writeError;
        }
        this.envelope = {...this.envelope,revision:next,base:sent.data,pending:this.envelope !== sent};
        this.persist();
        this.channel?.postMessage({account:id,writer:this.writer});
      }
      this.ready.set(true); this.status.set('Synchronisé avec votre compte');
      this.retryAttempt = 0;
    } catch {
      if (generation === this.generation) {
        // Cached cloud state remains usable offline; a first-time load must succeed.
        this.ready.set(this.envelope.revision > 0 || this.envelope.pending);
        this.status.set(this.envelope.pending ? 'Modifications conservées sur cet appareil · réessayer la synchronisation' : 'Cloud indisponible · réessayer');
        // Bounded exponential delay; no retry once account/generation changes.
        if (navigator.onLine && !this.destroyed) {
          const delay = Math.min(60000, 2000 * 2 ** Math.min(this.retryAttempt++, 5));
          this.retryTimer = setTimeout(() => {
            if (generation === this.generation) void this.sync(generation);
          }, delay);
        }
      }
    } finally {
      this.flushing = false;
      if (generation !== this.generation) void this.sync();
    }
  }
  private mergeRemote(revision:number,remote:Workspace):boolean {
    if (!this.envelope.base) {
      this.conflict.set(true); this.conflictItems.set([]); this.ready.set(true);
      this.status.set('Ancien cache : comparaison automatique impossible. Exportez une copie avant de recharger.');
      return false;
    }
    const merge=mergeWorkspace(this.envelope.base,this.envelope.data,remote);
    if (merge.conflicts.length) {
      saveRecoveryBackup(localStorage,this.userId!,this.envelope);
      this.remoteConflict={revision,data:remote,merge};
      this.conflictItems.set(merge.conflicts); this.conflict.set(true); this.ready.set(true);
      this.status.set(merge.conflicts.length+' conflit(s) à comparer · aucune version écrasée');
      return false;
    }
    const previous=this.envelope;
    saveRecoveryBackup(localStorage,this.userId!,previous);
    this.envelope={revision,data:merge.data,base:remote,pending:true};
    try { this.persist(); } catch(error) { this.envelope=previous; throw error; }
    this.contextVersion.update(v=>v+1);
    return true;
  }
  async resolveConflicts(choices:Record<string,MergeChoice>) {
    if (!this.userId || !this.remoteConflict || this.flushing) return;
    try {
      const remote=this.remoteConflict;
      const data=resolveWorkspaceMerge(remote.merge,choices);
      const previous=this.envelope;
      saveRecoveryBackup(localStorage,this.userId,previous);
      this.envelope={revision:remote.revision,data,base:remote.data,pending:true};
      try { this.persist(); } catch(error) { this.envelope=previous; throw error; }
      this.conflict.set(false); this.conflictItems.set([]); this.remoteConflict=undefined;
      this.contextVersion.update(v=>v+1);
      this.status.set('Choix enregistrés sur cet appareil · synchronisation en cours');
      await this.sync();
    } catch(error) {
      this.status.set(error instanceof Error ? error.message : 'Résolution impossible · copie locale conservée');
    }
  }
  async reloadCloud() {
    const id = this.userId;
    if (!id || this.flushing) return;
    if (!confirm('Ma’at conservera une sauvegarde de secours sur cet appareil avant de charger la version cloud. Continuer ?')) return;
    const generation = this.generation;
    try {
      saveRecoveryBackup(localStorage, id, this.envelope);
    } catch {
      this.status.set('Récupération annulée : sauvegarde de secours impossible. Exportez votre copie.');
      return;
    }
    this.flushing = true;
    try {
      const {data,error} = await this.auth.client.from('taskboard_workspaces').select('revision,data').eq('user_id',id).maybeSingle();
      if (generation !== this.generation) return;
      if (error) throw error;
      const replacement: Envelope = {revision:data?.revision ?? 0,data:data?.data ?? {},base:data?.data ?? {},pending:false};
      // Persist successfully before replacing the state visible to the user.
      localStorage.setItem(this.cacheKey(id), JSON.stringify(replacement));
      this.envelope = replacement;
      this.mirror(id,replacement);
      this.conflict.set(false); this.conflictItems.set([]); this.remoteConflict=undefined; this.ready.set(true); this.retryAttempt = 0;
      clearTimeout(this.retryTimer);
      this.contextVersion.update(v => v + 1);
      this.status.set('Cloud rechargé · sauvegarde de secours conservée sur cet appareil');
    } catch {
      if (generation === this.generation) this.status.set('Récupération impossible · votre version locale et sa sauvegarde sont conservées');
    } finally {
      this.flushing = false;
      if (generation !== this.generation) void this.sync();
    }
  }
  exportRecoveryBackup() {
    if (!this.userId) return;
    try {
      const raw = localStorage.getItem('maat_recovery_' + this.userId);
      if (!raw) { this.status.set('Aucune sauvegarde de secours pour ce compte sur cet appareil'); return; }
      const url = URL.createObjectURL(new Blob([raw], {type:'application/json'}));
      const link = document.createElement('a'); link.href = url;
      link.download = 'maat-secours-' + new Date().toISOString().slice(0,10) + '.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { this.status.set('Téléchargement de la sauvegarde impossible'); }
  }
  async exportDeviceCopies() {
    const id=this.userId ?? '__local__';
    const generation=this.generation;
    await this.mirrorQueue;
    try {
      const copies=await this.checkpoints.list(id).catch(()=>[]);
      if(generation!==this.generation || id!==(this.userId ?? '__local__')) return;
      const journals=[];
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i);
        if(key?.startsWith(this.cacheKey(id)+'_draft_')){
          const raw=localStorage.getItem(key);
          if(raw) {try{journals.push(JSON.parse(raw));}catch{/* Preserve other readable copies. */}}
        }
      }
      const content={app:'Maat',version:3,kind:'device-copies',accountId:id,exportedAt:new Date().toISOString(),copies,journals};
      const url=URL.createObjectURL(new Blob([JSON.stringify(content,null,2)],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download='maat-copies-appareil-'+new Date().toISOString().slice(0,10)+'.json';link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch {this.status.set('Export des copies de cet appareil impossible');}
  }
}
