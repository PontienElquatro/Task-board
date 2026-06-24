import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task } from '../models';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './task-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskCardComponent {
  @Input() task!: Task;

  @Output() selected = new EventEmitter<Task>();
  @Output() edit = new EventEmitter<Task>();
  @Output() delete = new EventEmitter<Task>();

  onClick() {
    this.selected.emit(this.task);
  }

  onEdit(event: MouseEvent) {
    event.stopPropagation();
    this.edit.emit(this.task);
  }

  onDelete(event: MouseEvent) {
    event.stopPropagation();
    this.delete.emit(this.task);
  }

  getCompletedSubTasksCount(): number {
    return this.task.subTasks ? this.task.subTasks.filter(st => st.completed).length : 0;
  }

  isLate(): boolean {
    if (!this.task.dueDate || this.task.status === 'done') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(this.task.dueDate) < today;
  }

  isToday(): boolean {
    if (!this.task.dueDate) return false;
    const today = new Date();
    const dueDate = new Date(this.task.dueDate);
    return dueDate.getDate() === today.getDate() &&
           dueDate.getMonth() === today.getMonth() &&
           dueDate.getFullYear() === today.getFullYear();
  }
}
