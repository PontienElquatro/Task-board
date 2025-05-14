import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

type Status = 'todo' | 'in-progress' | 'done';

interface Task {
  id: string;
  title: string;
  description: string;
  status: Status;
}

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './task-card.component.html',
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
  this.delete.emit(this.task); // Le parent gère la confirmation maintenant
}
}
