import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CloudStorageProvider } from '../../providers/cloud-storage.provider';
import { MergeChoice } from '../../core/storage/workspace-merge';
@Component({
  selector:'app-sync-conflict',standalone:true,imports:[CommonModule],
  templateUrl:'./sync-conflict.component.html'
})
export class SyncConflictComponent {
  readonly cloud=inject(CloudStorageProvider);
  readonly choices=signal<Record<string,MergeChoice>>({});
  readonly busy=signal(false);
  readonly complete=computed(()=>this.cloud.conflictItems().length>0 &&
    this.cloud.conflictItems().every(item=>!!this.choices()[item.token]));
  constructor() { effect(()=>{this.cloud.conflictItems();this.choices.set({});}); }
  choose(token:string,choice:MergeChoice) {this.choices.update(value=>({...value,[token]:choice}));}
  preview(value:unknown):string {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return JSON.stringify(value,null,2) ?? '';
    const item=value as Record<string,unknown>;
    if (typeof item['title'] !== 'string') return JSON.stringify(value,null,2);
    const lines=[item['title']];
    if (typeof item['description'] === 'string' && item['description']) lines.push(item['description']);
    const statuses:Record<string,string>={'todo':'À faire','in-progress':'En cours','done':'Terminé'};
    const priorities:Record<string,string>={'high':'Haute','medium':'Moyenne','low':'Basse'};
    if (typeof item['status'] === 'string') lines.push('Statut : '+(statuses[item['status']] ?? item['status']));
    if (typeof item['priority'] === 'string') lines.push('Priorité : '+(priorities[item['priority']] ?? item['priority']));
    if (item['dueDate']) lines.push('Échéance : '+String(item['dueDate']).slice(0,10));
    if (Array.isArray(item['tags']) && item['tags'].length) lines.push('Tags : '+item['tags'].join(', '));
    if (Array.isArray(item['subTasks']) && item['subTasks'].length) lines.push('Sous-tâches : '+JSON.stringify(item['subTasks']));
    if (item['archived']) lines.push('Archivé');
    if (typeof item['order'] === 'number') lines.push('Position : '+item['order']);
    return lines.join('\n\n');
  }
  async apply() {if(!this.complete()||this.busy()) return;this.busy.set(true);try{await this.cloud.resolveConflicts(this.choices());}finally{this.busy.set(false);}}
}
