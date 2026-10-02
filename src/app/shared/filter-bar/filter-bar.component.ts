import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../services/task.service';

/** Presentation boundary; the existing task service remains the source of truth. */
@Component({
  selector:'app-filter-bar', standalone:true, imports:[CommonModule,FormsModule],
  templateUrl:'./filter-bar.component.html', changeDetection:ChangeDetectionStrategy.OnPush
})
export class FilterBarComponent {
  readonly taskService = inject(TaskService);
  @Input() hasActiveFilters = false;
  @Output() resetFilters = new EventEmitter<void>();
}
