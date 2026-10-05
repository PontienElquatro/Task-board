import { Component, effect, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { IconComponent } from './icon.component';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
interface Notification {id:string;title:string;team_id:string;project_id:string;task_id:string;read_at:string|null;created_at:string;}
@Component({selector:'app-notifications',standalone:true,imports:[IconComponent,CommonModule,RouterLink],template:`
<details *ngIf="auth.user()" class="group/notifications relative" #menu (toggle)="menu.open && load()" (keydown.escape)="menu.open=false">
 <summary aria-label="Ouvrir les notifications" class="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-transparent bg-blue-50 px-3 text-sm text-blue-700 transition-all duration-200 hover:border-blue-200 hover:bg-blue-100 hover:shadow-sm motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:bg-blue-950 dark:text-blue-200 dark:hover:border-blue-800 dark:hover:bg-blue-900 [&::-webkit-details-marker]:hidden"><app-icon name="bell" class="origin-top text-blue-600 transition-transform duration-200 group-hover/notifications:-rotate-12 group-focus-within/notifications:-rotate-12 dark:text-blue-300 motion-reduce:transform-none motion-reduce:transition-none" /><span class="sr-only">Notifications</span> <span *ngIf="unread()" class="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white ring-2 ring-white dark:ring-gray-800">{{unread()}}</span></summary>
 <section class="absolute right-0 z-50 mt-2 grid max-h-[70dvh] w-80 max-w-[calc(100vw-2rem)] gap-2 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800" aria-label="Vos notifications">
  <header class="flex items-center justify-between border-b border-gray-100 pb-2 dark:border-gray-700"><h2 class="text-sm font-semibold">Notifications</h2><button class="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900" aria-label="Actualiser les notifications" (click)="load()"><app-icon name="refresh" /></button></header><p *ngIf="error()" role="status" class="text-xs">{{error()}}</p>
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
 async read(item:Notification){if(item.read_at)return;const epoch=this.epoch;const date=new Date().toISOString();const r=await this.auth.client.from('taskboard_notifications').update({read_at:date}).eq('id',item.id);if(!r.error && epoch===this.epoch)this.items.update(items=>items.map(n=>n.id===item.id?{...n,read_at:date}:n));}
}
