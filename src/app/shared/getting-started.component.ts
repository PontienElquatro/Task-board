import { Component, Input, computed, effect, inject, untracked, Injector, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ProjectService } from '../services/project.service';
import { TaskService } from '../services/task.service';
import { IconComponent } from './icon.component';
import { OnboardingService } from '../services/onboarding.service';

@Component({selector:'app-getting-started',standalone:true,imports:[CommonModule,RouterLink,IconComponent],template:`
<p *ngIf="guide.error() && !force" role="alert" class="mb-4 rounded-xl bg-orange-50 p-4 text-sm text-orange-800 dark:bg-orange-950 dark:text-orange-200">{{guide.error()}} <button type="button" class="secondary min-h-11" (click)="guide.retry()">Réessayer</button></p>
<section *ngIf="force || (!guide.hidden() && completed()<2)" aria-label="Premiers pas dans Ma’at" class="mb-6 overflow-hidden rounded-2xl border border-blue-100 bg-white dark:border-indigo-900 dark:bg-gray-900">
 <header class="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 dark:from-blue-950 dark:to-indigo-950 sm:p-5">
  <div><p class="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Bienvenue dans votre espace</p><h2 class="mt-1 text-lg font-semibold text-indigo-950 dark:text-white">Prenez vos marques, à votre rythme.</h2><p class="mt-2 text-sm text-gray-600 dark:text-gray-300">{{completed()}} / 2 étapes essentielles réalisées · L’équipe est facultative.</p></div>
  <button *ngIf="!force" type="button" (click)="dismiss()" class="min-h-11 rounded-xl px-3 text-sm text-blue-700 hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-300 dark:hover:bg-indigo-900">Passer le guide</button>
 </header>
 <div role="progressbar" aria-label="Progression du démarrage" [attr.aria-valuenow]="completed()" aria-valuemin="0" aria-valuemax="2" class="h-1 bg-blue-100 dark:bg-indigo-950"><div class="h-full bg-blue-600 transition-all motion-reduce:transition-none" [style.width.%]="completed()*50"></div></div>
 <ol class="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
  <li class="rounded-xl border border-blue-100 p-4 dark:border-indigo-900"><span class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300"><app-icon [name]="hasProject() ? 'check' : 'folder'" /></span><h3 class="mt-3 text-sm font-semibold">1. Créez votre projet</h3><p class="mt-2 text-xs leading-5 text-gray-600 dark:text-gray-300">Un tableau pour votre objectif, vos idées et vos prochaines actions.</p><p *ngIf="hasProject()" class="mt-3 text-xs font-semibold text-green-700 dark:text-green-300">Étape réalisée</p><a routerLink="/projects" [queryParams]="hasProject() ? {} : {create:'project'}" class="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">{{hasProject() ? 'Voir mes projets' : 'Créer un projet'}}<app-icon name="arrow-right" /></a></li>
  <li class="rounded-xl border border-blue-100 p-4 dark:border-indigo-900"><span class="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"><app-icon [name]="hasTask() ? 'check' : 'board'" /></span><h3 class="mt-3 text-sm font-semibold">2. Ajoutez une tâche</h3><p class="mt-2 text-xs leading-5 text-gray-600 dark:text-gray-300">Commencez par une action simple. Les détails peuvent venir ensuite.</p><p *ngIf="hasTask()" class="mt-3 text-xs font-semibold text-green-700 dark:text-green-300">Étape réalisée</p><a routerLink="/board" [queryParams]="hasTask() ? {} : {create:'task'}" class="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">{{hasTask() ? 'Voir mon tableau' : 'Ajouter une tâche'}}<app-icon name="arrow-right" /></a></li>
  <li class="rounded-xl border border-blue-100 p-4 dark:border-indigo-900"><span class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300"><app-icon name="team" /></span><h3 class="mt-3 text-sm font-semibold">3. Avancez en équipe <span class="text-xs font-normal text-gray-500 dark:text-gray-400">Facultatif</span></h3><p class="mt-2 text-xs leading-5 text-gray-600 dark:text-gray-300">Créez une équipe et invitez un membre pour partager votre travail.</p><a routerLink="/team" class="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">Créer ou rejoindre une équipe<app-icon name="arrow-right" /></a></li>
 </ol>
 <p *ngIf="force" class="px-5 pb-5 text-xs text-gray-500 dark:text-gray-400">Retrouvez ce guide ici à tout moment. Votre progression reflète vos projets et tâches existants.</p>
</section>`})
export class GettingStartedComponent implements OnInit {
 @Input() force=false;
 private readonly auth=inject(AuthService);
 private readonly projects=inject(ProjectService);
 private readonly tasks=inject(TaskService);
 readonly guide=inject(OnboardingService);
 private readonly injector=inject(Injector);
 readonly hasProject=computed(()=>this.projects.projects().length>0);
 readonly hasTask=computed(()=>this.tasks.tasks().length>0);
 readonly completed=computed(()=>Number(this.hasProject())+Number(this.hasTask()));
 ngOnInit(){effect(()=>{this.auth.user();const initializing=this.auth.initializing();const completed=this.completed();untracked(()=>{if(!this.force&&!initializing){this.guide.enter();if(completed===2)this.guide.dismiss();}});},{injector:this.injector});}
 dismiss(){this.guide.dismiss();}
}
