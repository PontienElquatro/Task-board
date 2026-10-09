import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../icon.component';
import { TaskService } from '../../services/task.service';
import { Project } from '../../models';
import { DismissMenuDirective } from '../dismiss-menu.directive';

/** Presentation boundary; the existing task service remains the source of truth. */
@Component({
  selector:'app-filter-bar', standalone:true, imports:[DismissMenuDirective,IconComponent,CommonModule,FormsModule],
  templateUrl:'./filter-bar.component.html', changeDetection:ChangeDetectionStrategy.OnPush
})
export class FilterBarComponent {
  @Input() projects: Project[] = [];
  readonly taskService = inject(TaskService);
  readonly advancedCount = computed(() => Number(!!this.taskService.filterProject()) + Number(this.taskService.filterPriority() !== 'all') + Number(!!this.taskService.filterTag()) + Number(this.taskService.filterDue() !== 'all') + Number(this.taskService.sort() !== 'manual'));
  @Input() hasActiveFilters = false;
  @Output() resetFilters = new EventEmitter<void>();
}
