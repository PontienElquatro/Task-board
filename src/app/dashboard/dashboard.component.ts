import { Component, computed, effect, inject, untracked, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService } from '../services/dashboard.service';
import { RouterLink } from '@angular/router';
import { BrandComponent } from '../shared/brand/brand.component';
import { TaskService } from '../services/task.service';
import { ProjectService } from '../services/project.service';
import { Task } from '../models';
import { isOverdue } from '../models/task-utils';
import { TaskModalComponent } from '../task-modal/task-modal.component';
import { STORAGE_PROVIDER } from '../providers/storage.provider';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, BrandComponent, TaskModalComponent],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent {
  public dashboardService = inject(DashboardService);
  readonly tasks=inject(TaskService);
  readonly projects=inject(ProjectService);
  selected:Task|null=null;
  error='';
  private readonly storage=inject(STORAGE_PROVIDER);
  constructor(){if(this.storage.contextVersion)effect(()=>{this.storage.contextVersion!();untracked(()=>{this.selected=null;this.error='';});});}
  readonly nextActions=computed(()=>this.tasks.activeTasks().filter(t=>t.status!=='done').sort((a,b)=>{
    const late=Number(isOverdue(b))-Number(isOverdue(a));
    if(late)return late;
    return (a.dueDate?.getTime()??Infinity)-(b.dueDate?.getTime()??Infinity)||Number(b.priority==='high')-Number(a.priority==='high');
  }).slice(0,5));
  readonly projectProgress=computed(()=>this.projects.projects().filter(p=>!p.archived).map(p=>{
    const tasks=this.tasks.activeTasks().filter(t=>t.projectId===p.id),done=tasks.filter(t=>t.status==='done').length;
    return {...p,total:tasks.length,done,percent:tasks.length?Math.round(done/tasks.length*100):0};
  }));
  overdue(task:Task){return isOverdue(task);}
  open(task:Task){this.error='';this.selected=task;}
  save(task:Task){try{this.tasks.updateTask(task);this.selected=null;}catch(e){this.error=e instanceof Error?e.message:'Enregistrement impossible.';}}
}
