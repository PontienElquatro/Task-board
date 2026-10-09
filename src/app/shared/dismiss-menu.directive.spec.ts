import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DismissMenuDirective } from './dismiss-menu.directive';
@Component({standalone:true,imports:[DismissMenuDirective],template:`<details appDismissMenu><summary>Actions</summary><button>Action</button></details>`})
class Host {}
describe('DismissMenuDirective',()=>{
 function setup(){const fixture=TestBed.createComponent(Host);fixture.detectChanges();return {fixture,menu:fixture.nativeElement.querySelector('details') as HTMLDetailsElement};}
 beforeEach(()=>TestBed.configureTestingModule({imports:[Host]}));
 it('closes on outside click without changing internal controls',()=>{
  const {fixture,menu}=setup();menu.open=true;
  menu.querySelector('button')!.click();expect(menu.open).toBeTrue();
  document.body.click();expect(menu.open).toBeFalse();fixture.destroy();
 });
 it('Escape closes and returns focus to the trigger',()=>{
  const {fixture,menu}=setup();menu.open=true;
  const summary=menu.querySelector('summary')!;spyOn(summary,'focus');
  menu.querySelector('button')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  expect(menu.open).toBeFalse();expect(summary.focus).toHaveBeenCalled();fixture.destroy();
 });
});
