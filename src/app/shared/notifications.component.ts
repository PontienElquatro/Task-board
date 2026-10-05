import { Component, effect, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { IconComponent } from './icon.component';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AvatarComponent } from './avatar.component';
import { DismissMenuDirective } from './dismiss-menu.directive';
interface Notification {id:string;title:string;team_id:string;project_id:string;task_id:string;read_at:string|null;created_at:string;actor_name?:string|null;actor_avatar_url?:string|null;project_name?:string|null;}
@Component({selector:'app-notifications',standalone:true,imports:[DismissMenuDirective,IconComponent,CommonModule,RouterLink,AvatarComponent],template:`
<details appDismissMenu *ngIf="auth.user()" class="group/notifications relative" #menu (toggle)="menu.open && load()">
 <summary aria-label="Ouvrir les notifications" class="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-transparent bg-blue-50 px-3 text-sm text-blue-700 transition-all duration-200 hover:border-blue-200 hover:bg-blue-100 hover:shadow-sm motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:bg-blue-950 dark:text-blue-200 dark:hover:border-blue-800 dark:hover:bg-blue-900 [&::-webkit-details-marker]:hidden"><app-icon name="bell" class="origin-top text-blue-600 transition-transform duration-200 group-hover/notifications:-rotate-12 group-focus-within/notifications:-rotate-12 dark:text-blue-300 motion-reduce:transform-none motion-reduce:transition-none" /><span class="sr-only">Notifications</span> <span *ngIf="unread()" class="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white ring-2 ring-white dark:ring-gray-800">{{unread()}}</span></summary>
 <section class="fixed inset-x-4 top-20 z-50 grid max-h-[calc(100dvh-6rem)] gap-2 overflow-y-auto overscroll-contain rounded-2xl border border-blue-100 bg-white p-4 shadow-xl lg:absolute lg:inset-x-auto lg:right-0 lg:top-full lg:mt-2 lg:max-h-[70dvh] lg:w-96 dark:border-indigo-900 dark:bg-gray-900" aria-label="Vos notifications">
  <header class="flex items-center justify-between border-b border-blue-100 pb-2 dark:border-indigo-900"><h2 class="text-sm font-semibold text-indigo-950 dark:text-gray-100">Notifications</h2><div class="flex gap-1"><button class="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-300 dark:hover:bg-blue-950" aria-label="Actualiser les notifications" (click)="load()"><app-icon name="refresh" /></button><button class="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-300 dark:hover:bg-gray-800" aria-label="Fermer les notifications" (click)="menu.open=false;menu.querySelector('summary')?.focus()"><app-icon name="close" /></button></div></header><p *ngIf="error()" role="status" class="text-xs text-red-700 dark:text-red-300">{{error()}}</p>
  <p role="status" class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"><span class="h-2 w-2 rounded-full" [class.bg-green-500]="live()" [class.bg-amber-500]="!live()"></span>{{live() ? 'En direct' : 'Actualisation de secours'}}</p>
  <button *ngIf="items().length && !confirmClear()" type="button" [disabled]="busy()" (click)="confirmClear.set(true)" class="flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950"><app-icon name="trash" />Tout effacer</button>
  <div *ngIf="confirmClear()" class="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950" role="group" aria-label="Confirmation d’effacement">
   <p class="text-sm text-red-800 dark:text-red-200">Effacer toutes vos notifications actuelles ? Les prochaines resteront visibles. Vos tâches ne seront pas supprimées.</p>
   <div class="mt-2 flex gap-2"><button type="button" [disabled]="busy()" (click)="confirmClear.set(false)" class="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-50">Annuler</button><button type="button" [disabled]="busy()" (click)="dismiss()" class="min-h-11 rounded-lg bg-red-700 px-3 text-sm text-white hover:bg-red-800 disabled:opacity-50">{{busy() ? 'Effacement…' : 'Confirmer'}}</button></div>
  </div>
  <p *ngIf="!items().length && !error()" class="text-sm text-gray-500 dark:text-gray-400">Vous êtes à jour. Vos prochaines alertes apparaîtront ici.</p>
  <div *ngFor="let item of items()" class="flex items-start gap-1"><a routerLink="/team-projects" [queryParams]="{team:item.team_id,project:item.project_id}" [fragment]="'task-'+item.task_id" (click)="read(item);menu.open=false" class="flex min-w-0 flex-1 gap-3 rounded-xl border border-gray-200 p-3 text-sm transition-colors hover:border-blue-200 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-gray-700 dark:hover:bg-gray-900" [class.bg-blue-50]="!item.read_at" [class.dark:bg-blue-950]="!item.read_at"><app-avatar *ngIf="item.actor_name" class="h-9 w-9" [name]="item.actor_name || 'Membre'" [url]="item.actor_avatar_url" /><span class="min-w-0"><span *ngIf="item.actor_name" class="mb-1 block text-xs font-semibold text-indigo-700 dark:text-indigo-200">{{item.actor_name}}</span><span class="block break-words" [class.font-semibold]="!item.read_at">{{item.title}}</span><span *ngIf="item.project_name" class="mt-1 block text-xs text-gray-600 dark:text-gray-300">{{item.project_name}}</span><span class="mt-2 block text-xs text-gray-500 dark:text-gray-400">{{item.created_at | date:'dd/MM HH:mm'}} · {{item.read_at ? 'Lue' : 'Nouvelle'}}</span></span></a><button type="button" [disabled]="busy()" [attr.aria-label]="'Effacer la notification : '+item.title" (click)="dismiss(item)" class="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-red-950 dark:hover:text-red-300"><app-icon name="trash" /></button></div>
 </section>
</details>`})
export class NotificationsComponent {
 readonly auth=inject(AuthService);readonly items=signal<Notification[]>([]);readonly error=signal('');
 private readonly platform=inject(PLATFORM_ID);private epoch=0;
 readonly live=signal(false);readonly busy=signal(false);readonly confirmClear=signal(false);
 private request=0;
 constructor(){effect(cleanup=>{
  const account=this.auth.user()?.id;const epoch=++this.epoch;
  this.items.set([]);this.error.set('');this.live.set(false);this.busy.set(false);this.confirmClear.set(false);
  if(!account||!isPlatformBrowser(this.platform))return;
  void this.load();
  const channel=this.auth.client.channel('notifications-'+account+'-'+epoch)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'taskboard_notifications',filter:'user_id=eq.'+account},()=>{if(epoch===this.epoch)void this.load();})
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'taskboard_notifications',filter:'user_id=eq.'+account},()=>{if(epoch===this.epoch)void this.load();})
   .subscribe(status=>{if(epoch!==this.epoch)return;this.live.set(status==='SUBSCRIBED');if(status==='SUBSCRIBED')void this.load();});
  const timer=setInterval(()=>void this.load(),60000);
  cleanup(()=>{this.epoch++;clearInterval(timer);void this.auth.client.removeChannel(channel);});
 });}
 unread(){return this.items().filter(n=>!n.read_at).length;}
 async load(){const account=this.auth.user()?.id,epoch=this.epoch,request=++this.request;if(!account)return;const r=await this.auth.client.from('taskboard_notifications').select('id,title,team_id,project_id,task_id,read_at,created_at,actor_name,actor_avatar_url,project_name').eq('user_id',account).is('dismissed_at',null).order('created_at',{ascending:false}).limit(50);if(epoch!==this.epoch||request!==this.request)return;if(r.error){this.error.set('Notifications indisponibles.');return;}this.error.set('');this.items.set(r.data??[]);}
 async read(item:Notification){if(item.read_at)return;const epoch=this.epoch;const date=new Date().toISOString();const r=await this.auth.client.from('taskboard_notifications').update({read_at:date}).eq('id',item.id);if(epoch!==this.epoch)return;if(r.error){this.error.set('Impossible de marquer cette notification comme lue.');return;}this.request++;this.items.update(items=>items.map(n=>n.id===item.id?{...n,read_at:date}:n));}
 async dismiss(item?:Notification){
  const account=this.auth.user()?.id,epoch=this.epoch;
  if(!account||this.busy()||(!item&&!this.confirmClear()))return;
  this.busy.set(true);this.error.set('');
  const cutoff=new Date().toISOString();
  try{
   let query=this.auth.client.from('taskboard_notifications').update({dismissed_at:cutoff}).eq('user_id',account).is('dismissed_at',null);
   query=item?query.eq('id',item.id):query.lte('created_at',cutoff);
   const result=await query;
   if(epoch!==this.epoch)return;
   if(result.error){this.error.set('Effacement impossible. Vos notifications sont conservées.');return;}
   this.confirmClear.set(false);await this.load();
  }catch{if(epoch===this.epoch)this.error.set('Effacement impossible. Réessayez dans un instant.');}
  finally{if(epoch===this.epoch)this.busy.set(false);}
 }
}
