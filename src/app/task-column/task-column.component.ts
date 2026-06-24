import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task, Status } from '../models';
import { TaskCardComponent } from '../task-card/task-card.component';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-task-column',
  standalone: true,
  imports: [CommonModule, TaskCardComponent, DragDropModule],
  templateUrl: './task-column.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskColumnComponent {
  @Input() label!: string;
  @Input() status!: Status;
  @Input() tasks: Task[] = [];

  @Output() taskSelected = new EventEmitter<Task>();
  @Output() taskEdit = new EventEmitter<Task>();
  @Output() taskDelete = new EventEmitter<Task>();
  @Output() taskDropped = new EventEmitter<CdkDragDrop<Task[]>>();

  drop(event: CdkDragDrop<Task[]>) {
    this.taskDropped.emit(event);
  }

  trackById(index: number, task: Task) {
    return task.id;
  }
}
