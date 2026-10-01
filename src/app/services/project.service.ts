import { Injectable, inject, signal, computed, effect, untracked } from '@angular/core';
import { STORAGE_PROVIDER } from '../providers/storage.provider';
import { Project } from '../models';
@Injectable({providedIn:'root'})
export class ProjectService {
  private readonly storage=inject(STORAGE_PROVIDER);
  private readonly key='mytaskboard_projects';
  readonly error=signal('');
  private readonly state=signal<Project[]>(this.load());
  readonly projects=this.state.asReadonly();
  readonly active=computed(()=>this.projects().filter(p=>!p.archived));
  constructor() {if(this.storage.contextVersion) effect(()=>{this.storage.contextVersion!(); untracked(()=>this.state.set(this.load()));});}
  private load():Project[] {
    try {
      const data=this.storage.getItem<unknown>(this.key);
      if(data===null) {this.error.set(''); return [];}
      if(!Array.isArray(data)||data.length>1000||!data.every(p=>p&&typeof p.id==='string'&&typeof p.title==='string'&&p.title.trim()&&p.title.length<=100)) throw new Error();
      if(new Set(data.map(p=>p.id)).size!==data.length) throw new Error();
      this.error.set(''); return data;
    } catch {this.error.set('Projets illisibles : modifications bloquées pour protéger les données.'); return [];}
  }
  private commit(projects:Project[]) { if(this.error()) throw new Error(this.error()); this.storage.setItem(this.key,projects); this.state.set(projects); }
  save(title:string,id?:string) {
    title=title.trim(); if(!title||title.length>100) throw new Error('Nom de projet requis, 100 caractères maximum.');
    if(id) {if(!this.projects().some(p=>p.id===id)) throw new Error('Projet introuvable.'); this.commit(this.projects().map(p=>p.id===id?{...p,title}:p)); return id;}
    if(this.projects().length>=1000) throw new Error('Maximum 1 000 projets.');
    const created={id:crypto.randomUUID(),title}; this.commit([...this.projects(),created]); return created.id;
  }
  archive(id:string) {this.commit(this.projects().map(p=>p.id===id?{...p,archived:!p.archived}:p));}
}
