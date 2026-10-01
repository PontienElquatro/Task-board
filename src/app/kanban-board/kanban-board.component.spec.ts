import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KanbanBoardComponent } from './kanban-board.component';
import { provideRouter } from '@angular/router';
import { STORAGE_PROVIDER } from '../providers/storage.provider';

describe('KanbanBoardComponent', () => {
  let component: KanbanBoardComponent;
  let fixture: ComponentFixture<KanbanBoardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KanbanBoardComponent],
      providers: [provideRouter([]), { provide: STORAGE_PROVIDER, useValue: { getItem: () => null, setItem: () => {}, removeItem: () => {} } }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(KanbanBoardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
