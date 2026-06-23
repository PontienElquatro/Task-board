import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task } from '../services/task.service';

@Component({
  selector: 'app-task-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-modal.component.html',
})
export class TaskModalComponent implements OnChanges {
  @Input() task: Task | null = null;
  @Input() mode: 'view' | 'edit' | 'delete' = 'view';

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<Task>();
  @Output() confirmDelete = new EventEmitter<void>();

  tempTask: Task | null = null;

  ngOnChanges() {
    if (this.task) {
      this.tempTask = { ...this.task };
    } else {
      this.tempTask = null;
    }
  }

  onSave() {
    if (this.tempTask) {
      this.save.emit(this.tempTask);
    }
  }
}
