import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskModalComponent } from './task-modal.component';
import { STORAGE_PROVIDER } from '../providers/storage.provider';

describe('TaskModalComponent', () => {
  let component: TaskModalComponent;
  let fixture: ComponentFixture<TaskModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskModalComponent],
      providers: [{ provide: STORAGE_PROVIDER, useValue: { getItem: () => null, setItem: () => {}, removeItem: () => {} } }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaskModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
