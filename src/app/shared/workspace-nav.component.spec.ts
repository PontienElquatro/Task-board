import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WorkspaceNavComponent } from './workspace-nav.component';

describe('Navigation commune Ma’at',()=>{
 beforeEach(()=>TestBed.configureTestingModule({imports:[WorkspaceNavComponent],providers:[provideRouter([])]}));
 it('propose les mêmes destinations dans tout l’espace de travail',()=>{
  const fixture=TestBed.createComponent(WorkspaceNavComponent);fixture.detectChanges();
  const nav=fixture.nativeElement as HTMLElement;
  for(const path of ['/board','/projects','/calendar','/dashboard','/team','/settings','/help'])expect(nav.querySelector('a[href="'+path+'"]')).toBeTruthy();
  expect(nav.querySelector('nav')?.getAttribute('aria-label')).toBe('Navigation principale');
 });
});
