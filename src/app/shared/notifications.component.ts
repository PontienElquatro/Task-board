import { Component, effect, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
interface Notification {id:string;title:string;team_id:string;project_id:string;task_id:string;read_at:string|null;created_at:string;}
@Component({selector:'app-notifications',standalone:true,imports:[CommonModule,RouterLink],template:`
<details *ngIf="auth.user()" class="relative" #menu (keydown.escape)="menu.open=false">
 <summary class="flex min-h-11 cursor-pointer items-center rounded-lg border border-gray-200 px-3 text-sm dark:border-gray-700">Notifications <span *ngIf="unread()" class="ml-2 rounded-full bg-blue-600 px-2 text-xs text-white">{{unread()}}</span></summary>
 <section class="absolute right-0 z-50 mt-2 grid max-h-[70dvh] w-80 max-w-[calc(100vw-2rem)] gap-2 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800" aria-label="Vos notifications">
  <button class="secondary min-h-11" (click)="load()">Actualiser</button><p *ngIf="error()" role="status" class="text-xs">{{error()}}</p>
  <p *ngIf="!items().length" class="text-sm text-gray-500 dark:text-gray-400">Aucune notification.</p>
  <a *ngFor="let item of items()" routerLink="/team-projects" [queryParams]="{team:item.team_id,project:item.project_id}" [fragment]="'task-'+item.task_id" (click)="read(item);menu.open=false" class="rounded-lg border border-gray-200 p-3 text-sm hover:bg-blue-50 dark:border-gray-700 dark:hover:bg-gray-900"><span [class.font-semibold]="!item.read_at">{{item.title}}</span><span class="mt-2 block text-xs text-gray-500 dark:text-gray-400">{{item.created_at | date:'dd/MM HH:mm'}} · {{item.read_at ? 'Lue' : 'Nouvelle'}}</span></a>
 </section>
</details>`})
export class NotificationsComponent {
 readonly auth=inject(AuthService);readonly items=signal<Notification[]>([]);readonly error=signal('');
 private readonly platform=inject(PLATFORM_ID);private epoch=0;
 constructor(){effect(cleanup=>{const account=this.auth.user()?.id;this.epoch++;this.items.set([]);if(!account||!isPlatformBrowser(this.platform))return;void this.load();const timer=setInterval(()=>void this.load(),60000);cleanup(()=>clearInterval(timer));});}
 unread(){return this.items().filter(n=>!n.read_at).length;}
 async load(){const account=this.auth.user()?.id,epoch=this.epoch;if(!account)return;const r=await this.auth.client.from('taskboard_notifications').select('id,title,team_id,project_id,task_id,read_at,created_at').order('created_at',{ascending:false}).limit(50);if(epoch!==this.epoch)return;if(r.error){this.error.set('Notifications indisponibles.');return;}this.error.set('');this.items.set(r.data??[]);}
 async read(item:Notification){if(item.read_at)return;const date=new Date().toISOString();const r=await this.auth.client.from('taskboard_notifications').update({read_at:date}).eq('id',item.id);if(!r.error)this.items.update(items=>items.map(n=>n.id===item.id?{...n,read_at:date}:n));}
}
