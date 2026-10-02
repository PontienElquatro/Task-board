import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CloudStorageProvider } from '../../providers/cloud-storage.provider';
import { TaskService } from '../../services/task.service';
import { RestoreCopy, readDeviceArchive } from '../../core/storage/device-restore';
@Component({selector:'app-device-restore',standalone:true,imports:[CommonModule],template:`
<section class="border border-gray-200 dark:border-gray-800 rounded-lg p-4 space-y-4" aria-label="Restauration guidée">
  <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Récupérer des tâches depuis une copie</h2>
  <p class="text-sm text-gray-500 dark:text-gray-400">Sélectionnez une archive « Copies de cet appareil ». Seules les tâches absentes seront ajoutées. Les tâches existantes, projets et objectifs ne seront pas remplacés.</p>
  <label class="block text-sm">Archive JSON (10 Mo maximum)<input class="block p-2" type="file" accept=".json,application/json" (change)="load($event)" /></label>
  <label *ngIf="copies().length" class="block text-sm">Version à examiner<select class="block p-2 border rounded" (change)="selected.set(+$any($event.target).value)"><option *ngFor="let copy of copies();index as i" [value]="i">{{copy.label}} · {{copy.tasks.length}} tâches</option></select></label>
  <ng-container *ngIf="current() as copy">
    <p class="text-sm">{{additions().length}} tâche(s) à récupérer · {{copy.tasks.length-additions().length}} identifiant(s) déjà présent(s), conservé(s).</p>
    <ul class="max-h-64 overflow-auto text-sm"><li *ngFor="let task of additions()" class="p-2 border-b border-gray-200 dark:border-gray-800">{{task.title}}</li></ul>
    <button class="primary" [disabled]="!additions().length || !cloud.ready() || cloud.conflict() || tasks.loadFailed()" (click)="apply()">Ajouter les tâches absentes</button>
  </ng-container>
  <p role="status" aria-live="polite" class="text-sm">{{message()}}</p>
</section>`})
export class DeviceRestoreComponent {
  readonly cloud=inject(CloudStorageProvider);
  readonly tasks=inject(TaskService);
  readonly copies=signal<RestoreCopy[]>([]);
  readonly selected=signal(0);
  readonly message=signal('');
  private readonly account=signal('');
  private request=0;
  readonly current=computed(()=>this.account()===this.accountId() ? this.copies()[this.selected()] : undefined);
  readonly additions=computed(()=>{
    const ids=new Set(this.tasks.tasks().map(task=>task.id));
    return (this.current()?.tasks ?? []).filter(task=>!ids.has(task.id));
  });
  private accountId(){return this.cloud.auth.user()?.id ?? '__local__';}
  async load(event:Event){
    const input=event.target as HTMLInputElement;
    const file=input.files?.[0];const request=++this.request;
    this.copies.set([]);this.message.set('');this.selected.set(0);
    if(!file)return;
    const account=this.accountId();
    try{
      if(file.size>10*1024*1024)throw new Error('Archive trop volumineuse (10 Mo maximum).');
      const copies=readDeviceArchive(JSON.parse(await file.text()),account);
      if(request!==this.request || account!==this.accountId())return;
      this.account.set(account);this.copies.set(copies);
      this.message.set('Vérifiez la version et les titres avant de confirmer.');
    }catch(error){if(request===this.request)this.message.set(error instanceof Error ? error.message : 'Archive illisible.');}
    finally{input.value='';}
  }
  apply(){
    if(!this.current() || !this.additions().length || !this.cloud.ready() || this.cloud.conflict() || this.tasks.loadFailed())return;
    try{const count=this.additions().length;this.tasks.importTasks(this.additions());this.message.set(count+' tâche(s) récupérée(s). Les données existantes ont été conservées.');}
    catch{this.message.set('Restauration non appliquée. Vérifiez le stockage et la synchronisation, puis réessayez.');}
  }
}
