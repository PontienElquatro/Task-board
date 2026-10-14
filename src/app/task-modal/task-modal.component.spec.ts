import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi, type Mock, type Mocked } from "vitest";
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TaskModalComponent } from './task-modal.component';
import { STORAGE_PROVIDER } from '../providers/storage.provider';
describe('TaskModalComponent', () => {
    let component: TaskModalComponent;
    let fixture: ComponentFixture<TaskModalComponent>;
    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TaskModalComponent],
            providers: [{ provide: STORAGE_PROVIDER, useValue: { getItem: () => null, setItem: () => { }, removeItem: () => { } } }]
        })
            .compileComponents();
        fixture = TestBed.createComponent(TaskModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });
    it('should create', () => {
        expect(component).toBeTruthy();
    });
    it('does not close the task when Escape was handled by a child control', () => {
        const close=vi.spyOn(component.close,'emit');
        const event=new KeyboardEvent('keydown',{key:'Escape',cancelable:true});
        event.preventDefault();
        component.escape(event);
        expect(close).not.toHaveBeenCalled();
    });
    it('Escape dismisses the discard prompt without abandoning edits', () => {
        const close=vi.spyOn(component.close,'emit');
        component.discardPrompt=true;
        const event=new KeyboardEvent('keydown',{key:'Escape',cancelable:true});
        component.escape(event);
        expect(event.defaultPrevented).toBe(true);
        expect(component.discardPrompt).toBe(false);
        expect(close).not.toHaveBeenCalled();
    });
    it('Escape closes an unchanged dialog', () => {
        const close=vi.spyOn(component.close,'emit');
        component.escape(new KeyboardEvent('keydown',{key:'Escape',cancelable:true}));
        expect(close).toHaveBeenCalledOnce();
    });
});
