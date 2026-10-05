import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task, Status } from '../models';
import { CardAppearanceService } from '../services/card-appearance.service';
import { IconComponent } from '../shared/icon.component';
import { AvatarComponent } from '../shared/avatar.component';
import { FormsModule } from '@angular/forms';
import { DismissMenuDirective } from '../shared/dismiss-menu.directive';
import { isOverdue, dayKey } from '../models/task-utils';
@Component({ selector: 'app-task-card', standalone: true, imports: [DismissMenuDirective, AvatarComponent, IconComponent, CommonModule, FormsModule], templateUrl: './task-card.component.html', changeDetection: ChangeDetectionStrategy.OnPush })
export class TaskCardComponent {
  readonly appearance = inject(CardAppearanceService);
  @Input() task!: Task;
  @Input() allowOrganize = true;
  @Input() canProgress = true;
  @Input() busy = false;
  @Input() responsible = '';
  @Input() responsibleAvatar:string|null|undefined = '';
  @Output() selected = new EventEmitter<Task>();
  @Output() edit = new EventEmitter<Task>();
  @Output() delete = new EventEmitter<Task>();
  @Output() archive = new EventEmitter<Task>();
  @Output() duplicate = new EventEmitter<Task>();
  @Output() statusChange = new EventEmitter<Status>();
  readonly priorities = { low: 'Basse', medium: 'Moyenne', high: 'Haute' };
  getCompletedSubTasksCount() { return this.task.subTasks.filter(st => st.completed).length; }
  isLate() { return isOverdue(this.task); }
  isToday() { return !!this.task.dueDate && dayKey(this.task.dueDate) === dayKey(new Date()); }
}
