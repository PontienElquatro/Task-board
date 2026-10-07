import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { UiFieldDirective } from './ui-field.directive';

@Component({standalone:true,imports:[FormsModule,UiFieldDirective],template:'<input appUiField name="title" [(ngModel)]="title" required aria-label="Titre" />'})
class FieldHost {title='';}
describe('Shared UI field',()=>{
 it('marks touched invalid fields without changing the input value',async()=>{
  await TestBed.configureTestingModule({imports:[FieldHost]}).compileComponents();
  const fixture=TestBed.createComponent(FieldHost);fixture.detectChanges();await fixture.whenStable();
  const input=fixture.nativeElement.querySelector('input') as HTMLInputElement;
  expect(input.getAttribute('aria-invalid')).toBeNull();
  input.dispatchEvent(new Event('blur'));fixture.detectChanges();
  expect(input.getAttribute('aria-invalid')).toBe('true');
  input.value='Ma tâche';input.dispatchEvent(new Event('input'));fixture.detectChanges();await fixture.whenStable();fixture.detectChanges();
  expect(input.getAttribute('aria-invalid')).toBeNull();
  expect(fixture.componentInstance.title).toBe('Ma tâche');
 });
});
