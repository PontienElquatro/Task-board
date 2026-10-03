import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, computed } from '@angular/core';
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
  readonly advancedCount = computed(() => Number(this.taskService.filterPriority() !== 'all') + Number(!!this.taskService.filterTag()) + Number(this.taskService.filterDue() !== 'all') + Number(this.taskService.sort() !== 'manual'));
  @Input() hasActiveFilters = false;
  @Output() resetFilters = new EventEmitter<void>();
}
