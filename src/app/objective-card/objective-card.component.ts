import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task, Objective } from '../models/objective.model';

@Component({
  selector: 'app-objective-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './objective-card.component.html',
})
export class ObjectiveCardComponent {
  @Input() objective!: Objective;
  @Output() open = new EventEmitter<string>(); // Emit l'ID de l'objectif

  getProgress(): number {
    if (!this.objective?.tasks.length) return 0;
    const done = this.objective.tasks.filter(t => t.status === 'done').length;
    return Math.round((done / this.objective.tasks.length) * 100);
  }

  onOpen() {
    this.open.emit(this.objective.id);
  }
}
