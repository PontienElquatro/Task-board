import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { KanbanBoardComponent } from './kanban-board/kanban-board.component';
import { TaskColumnComponent } from './task-column/task-column.component';
import { TaskModalComponent } from './task-modal/task-modal.component';
import { TaskCardComponent } from './task-card/task-card.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, KanbanBoardComponent, TaskColumnComponent, TaskCardComponent, TaskModalComponent,],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'my-task-board';
}
