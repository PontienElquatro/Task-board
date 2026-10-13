import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi, type Mock, type Mocked } from "vitest";
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TaskColumnComponent } from './task-column.component';
describe('TaskColumnComponent', () => {
    let component: TaskColumnComponent;
    let fixture: ComponentFixture<TaskColumnComponent>;
    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TaskColumnComponent]
        })
            .compileComponents();
        fixture = TestBed.createComponent(TaskColumnComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });
    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
