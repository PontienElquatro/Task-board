import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskCardComponent } from './task-card.component';

describe('TaskCardComponent', () => {
  let component: TaskCardComponent;
  let fixture: ComponentFixture<TaskCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaskCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('hides progress when there are no subtasks, including completed tasks', () => {
    fixture.componentRef.setInput('task', {id:'sample',title:'Exemple',description:'',status:'done',priority:'medium',tags:[],subTasks:[],createdAt:new Date(),userId:'local'});
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="progressbar"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('À démarrer');
  });

  it('shows the actual subtask progress', () => {
    fixture.componentRef.setInput('task', {id:'sample',title:'Exemple',description:'',status:'todo',priority:'medium',tags:[],subTasks:[{id:'one',title:'Étape',completed:true}],createdAt:new Date(),userId:'local'});
    fixture.detectChanges();
    const progress = fixture.nativeElement.querySelector('[role="progressbar"]');
    expect(progress.getAttribute('aria-valuenow')).toBe('1');
    expect(progress.getAttribute('aria-valuemax')).toBe('1');
  });

  it('keeps action events unchanged', () => {
    fixture.componentRef.setInput('task', {id:'sample',title:'Exemple',description:'',status:'todo',priority:'medium',tags:[],subTasks:[],createdAt:new Date(),userId:'local'});
    fixture.detectChanges();
    spyOn(component.selected, 'emit');
    const menu=fixture.nativeElement.querySelector('details') as HTMLDetailsElement;
    menu.open=true;
    menu.querySelector('button')!.click();
    expect(component.selected.emit).toHaveBeenCalledWith(component.task);
    expect(menu.open).toBeFalse();
  });
  it('regroupe les actions dans un menu nommé, fermé par défaut',()=>{
    fixture.componentRef.setInput('task',{id:'sample',title:'Exemple',description:'',status:'todo',priority:'medium',tags:[],subTasks:[],createdAt:new Date(),userId:'local'});
    fixture.detectChanges();
    const menu=fixture.nativeElement.querySelector('details') as HTMLDetailsElement;
    expect(menu.open).toBeFalse();
    expect(menu.querySelector('summary')?.getAttribute('aria-label')).toBe('Actions pour Exemple');
    expect(menu.querySelector('select')?.getAttribute('aria-label')).toBe('Statut de Exemple');
  });
});
