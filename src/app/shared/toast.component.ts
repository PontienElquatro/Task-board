import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from './icon.component';
import { ToastService } from '../services/toast.service';
@Component({selector:'app-toast',standalone:true,imports:[CommonModule,IconComponent],template:`
<div class="pointer-events-none fixed bottom-4 left-4 right-4 z-[250] flex justify-center sm:justify-end" role="status" aria-live="polite" aria-atomic="true">
 <div *ngIf="toast.message()" class="pointer-events-auto flex max-w-md items-center gap-4 rounded-xl border border-blue-200 bg-white p-4 text-sm text-gray-900 shadow-lg dark:border-blue-800 dark:bg-gray-800 dark:text-gray-100">
  <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><app-icon name="check" /></span>
  <span>{{toast.message()}}</span><button type="button" class="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-400 dark:hover:bg-gray-700" aria-label="Fermer la notification" (click)="toast.dismiss()"><app-icon name="close" /></button>
 </div>
</div>`})
export class ToastComponent {readonly toast=inject(ToastService);}
