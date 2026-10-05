import { Component, Input, Output, EventEmitter, OnChanges, inject, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { IconComponent } from '../shared/icon.component';
import { Task, SubTask } from '../models';
import { GoalService } from '../services/goal.service';
import { dayKey } from '../models/task-utils';
import { ProjectService } from '../services/project.service';
import { ModalScrollLockDirective } from '../shared/modal-scroll-lock.directive';
@Component({ selector: 'app-task-modal', standalone: true, imports: [ModalScrollLockDirective, IconComponent, CommonModule, FormsModule, A11yModule], templateUrl: './task-modal.component.html', changeDetection: ChangeDetectionStrategy.OnPush })
export class TaskModalComponent implements OnChanges {
  @Input() task: Task | null = null;
  @Input() mode: 'view' | 'edit' | 'delete' = 'view';
  @Input() error = '';
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<Task>();
  @Output() edit = new EventEmitter<Task>();
  @Output() remove = new EventEmitter<Task>();
  @Output() subTaskToggle = new EventEmitter<string>();
  @Output() confirmDelete = new EventEmitter<void>();
  readonly goalService = inject(GoalService);
  readonly projectService = inject(ProjectService);
  readonly statuses = { todo: 'À faire', 'in-progress': 'En cours', done: 'Terminé' };
  readonly priorities = { low: 'Basse', medium: 'Moyenne', high: 'Haute' };
  tempTask: Task | null = null;
  newSubTaskTitle = '';
  tagsText = '';
  dueText = '';
  discardPrompt = false;
  private original = '';
  ngOnChanges(changes: import('@angular/core').SimpleChanges) {
    if (!changes['task'] && !changes['mode']) return;
    this.tempTask = this.task ? { ...this.task, tags: [...(this.task.tags ?? [])], subTasks: this.task.subTasks.map(st => ({ ...st })) } : null;
    this.newSubTaskTitle = ''; this.discardPrompt = false;
    this.tagsText = this.task?.tags?.join(', ') ?? '';
    this.dueText = this.task?.dueDate ? dayKey(this.task.dueDate) : '';
    this.original = this.snapshot();
  }
  private snapshot() { return JSON.stringify([this.tempTask, this.tagsText, this.dueText, this.newSubTaskTitle]); }
  requestClose() {
    if (this.mode === 'edit' && this.snapshot() !== this.original) this.discardPrompt = true;
    else this.close.emit();
  }
  @HostListener('document:keydown.escape', ['$event'])
  escape(event: Event) { event.preventDefault(); this.requestClose(); }
  onSave() {
    if (!this.tempTask?.title.trim()) return;
    this.addSubTask();
    this.save.emit({ ...this.tempTask, title: this.tempTask.title.trim(),
      tags: [...new Set(this.tagsText.split(',').map(t => t.trim().slice(0, 30)).filter(Boolean))].slice(0, 10),
      dueDate: this.dueText ? new Date(this.dueText + 'T12:00:00') : undefined,
      subTasks: this.tempTask.subTasks.filter(s => s.title.trim()).map(s => ({ ...s, title: s.title.trim() }))
    });
  }
  addSubTask() {
    if (this.newSubTaskTitle.trim() && this.tempTask) {
      this.tempTask.subTasks.push({ id: crypto.randomUUID(), title: this.newSubTaskTitle.trim(), completed: false }); this.newSubTaskTitle = '';
    }
  }
  removeSubTask(id: string) { if (this.tempTask) this.tempTask.subTasks = this.tempTask.subTasks.filter(s => s.id !== id); }
  toggleSubTask(sub: SubTask) { sub.completed = !sub.completed; }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent) {
    if (this.mode === 'edit' && this.snapshot() !== this.original) { event.preventDefault(); event.returnValue = ''; }
  }
}
