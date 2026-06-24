import { Component, Input, Output, EventEmitter, OnChanges, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task, SubTask } from '../models';
import { GoalService } from '../services/goal.service';

@Component({
  selector: 'app-task-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskModalComponent implements OnChanges {
  @Input() task: Task | null = null;
  @Input() mode: 'view' | 'edit' | 'delete' = 'view';

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<Task>();
  @Output() confirmDelete = new EventEmitter<void>();

  public goalService = inject(GoalService);
  tempTask: Task | null = null;
  newSubTaskTitle: string = '';

  ngOnChanges() {
    if (this.task) {
      // Deep copy for subtasks
      this.tempTask = {
        ...this.task,
        subTasks: this.task.subTasks ? this.task.subTasks.map(st => ({ ...st })) : []
      };
    } else {
      this.tempTask = null;
    }
  }

  onSave() {
    if (this.tempTask) {
      this.save.emit(this.tempTask);
    }
  }

  addSubTask() {
    if (this.newSubTaskTitle.trim() && this.tempTask) {
      const newSub: SubTask = {
        id: crypto.randomUUID(),
        title: this.newSubTaskTitle.trim(),
        completed: false
      };
      this.tempTask.subTasks = [...(this.tempTask.subTasks || []), newSub];
      this.newSubTaskTitle = '';
    }
  }

  removeSubTask(id: string) {
    if (this.tempTask) {
      this.tempTask.subTasks = this.tempTask.subTasks.filter(st => st.id !== id);
    }
  }

  toggleSubTask(subTask: SubTask) {
    subTask.completed = !subTask.completed;
  }

  onDueDateChange(value: string) {
    if (this.tempTask) {
      this.tempTask.dueDate = value ? new Date(value) : undefined;
    }
  }
}
