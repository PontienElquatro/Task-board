import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task, Status } from '../models';
import { TaskCardComponent } from '../task-card/task-card.component';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
@Component({ selector: 'app-task-column', standalone: true, imports: [CommonModule, TaskCardComponent, DragDropModule], templateUrl: './task-column.component.html', changeDetection: ChangeDetectionStrategy.OnPush })
export class TaskColumnComponent {
  @Input() label = '';
  @Input() status: Status = 'todo';
  @Input() tasks: Task[] = [];
  @Input() dragDisabled = false;
  @Output() taskSelected = new EventEmitter<Task>();
  @Output() taskEdit = new EventEmitter<Task>();
  @Output() taskDelete = new EventEmitter<Task>();
  @Output() taskArchive = new EventEmitter<Task>();
  @Output() taskDuplicate = new EventEmitter<Task>();
  @Output() taskStatus = new EventEmitter<{task: Task; status: Status}>();
  @Output() taskAdd = new EventEmitter<void>();
  @Output() taskDropped = new EventEmitter<CdkDragDrop<Task[]>>();
  trackById(_index: number, task: Task) { return task.id; }
}
