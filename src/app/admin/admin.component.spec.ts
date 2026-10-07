import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AdminComponent } from './admin.component';
import { AuthService } from '../services/auth.service';
describe('AdminComponent',()=>{
  let fixture:ComponentFixture<AdminComponent>;
  let user:ReturnType<typeof signal<{id:string}|null>>;
  let invoke:jasmine.Spy;
  beforeEach(async()=>{
    user=signal<{id:string}|null>(null);
    invoke=jasmine.createSpy('invoke').and.resolveTo({data:null,error:new Error('Forbidden')});
    await TestBed.configureTestingModule({imports:[AdminComponent],providers:[provideRouter([]),{provide:AuthService,useValue:{user,adminAccess:signal(false),initializing:signal(false),client:{functions:{invoke}}}}]}).compileComponents();
    fixture=TestBed.createComponent(AdminComponent);fixture.detectChanges();
  });
  it('does not query administration for a guest',()=>{expect(invoke).not.toHaveBeenCalled();expect(fixture.nativeElement.textContent).toContain('Connexion nécessaire');});
  it('combines account filters and keeps page indicators scoped',()=>{
    const c=fixture.componentInstance;
    c.snapshot.set({total:75,page:1,workspaces:1,events:[],users:[
      {id:'a',email:'admin@example.invalid',createdAt:'2026-01-01',lastSignIn:new Date().toISOString(),confirmed:true,admin:true,updatedAt:'2026-01-02'},
      {id:'b',email:'new@example.invalid',createdAt:'2026-02-01',lastSignIn:null,confirmed:false,admin:false,updatedAt:null}
    ]});
    c.roleFilter='user';c.confirmationFilter='pending';c.syncFilter='none';
    expect(c.filteredUsers().map(u=>u.id)).toEqual(['b']);
    expect(c.confirmedCount()).toBe(1);expect(c.activeCount()).toBe(1);expect(c.pageCount()).toBe(2);
    c.resetFilters();expect(c.filteredUsers().length).toBe(2);
  });
  it('clears data when access is denied',async()=>{user.set({id:'user'});fixture.detectChanges();await fixture.whenStable();expect(fixture.componentInstance.snapshot()).toBeNull();expect(fixture.componentInstance.error()).toContain('Accès réservé');});
  it('ignores a delayed admin reply after logout',async()=>{
    let finish!:(value:unknown)=>void;
    invoke.and.returnValue(new Promise(resolve=>finish=resolve));
    user.set({id:'admin'});fixture.detectChanges();
    user.set(null);fixture.detectChanges();
    finish({data:{users:[{id:'admin',email:'private@example.invalid'}],total:1,page:1,workspaces:1,events:[]},error:null});
    await fixture.whenStable();fixture.detectChanges();
    expect(fixture.componentInstance.snapshot()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('private@example.invalid');
  });
  it('renders safe metadata and clears it on logout',async()=>{
    invoke.and.resolveTo({data:{users:[{id:'admin',email:'admin@example.invalid',createdAt:'2026-01-01',lastSignIn:null,confirmed:true,admin:true,updatedAt:null}],total:1,page:1,workspaces:1,events:[]},error:null});
    user.set({id:'admin'});fixture.detectChanges();await fixture.whenStable();fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Vue d’ensemble');
    fixture.componentInstance.section='users';fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('admin@example.invalid');
    fixture.componentInstance.search='absent';expect(fixture.componentInstance.filteredUsers()).toEqual([]);
    user.set(null);fixture.detectChanges();expect(fixture.componentInstance.snapshot()).toBeNull();expect(fixture.nativeElement.textContent).not.toContain('admin@example.invalid');
  });
});
