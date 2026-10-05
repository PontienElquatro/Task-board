import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { profileInitials } from '../core/profile';
@Component({selector:'app-avatar',standalone:true,imports:[CommonModule],host:{class:'inline-flex shrink-0'},template:`
<span class="inline-flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-xs font-semibold text-blue-800 ring-2 ring-white dark:from-blue-900 dark:to-indigo-900 dark:text-blue-100 dark:ring-gray-800" [title]="name">
 <img *ngIf="safeUrl && failedUrl!==safeUrl; else initials" [src]="safeUrl" alt="" referrerpolicy="no-referrer" class="h-full w-full object-cover" (error)="failedUrl=safeUrl" />
 <ng-template #initials>{{initialsForName}}</ng-template>
</span>`})
export class AvatarComponent {
 @Input() name='Membre';@Input() url:string|null|undefined='';failedUrl='';
 get safeUrl(){try{const url=new URL(this.url||'');return url.protocol==='https:'?url.href:'';}catch{return '';}}
 get initialsForName(){return profileInitials(this.name);}
}
