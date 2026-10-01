import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task, Status } from '../models';
import { FormsModule } from '@angular/forms';
import { isOverdue, dayKey } from '../models/task-utils';
@Component({ selector: 'app-task-card', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './task-card.component.html', changeDetection: ChangeDetectionStrategy.OnPush })
export class TaskCardComponent {
  @Input() task!: Task;
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
