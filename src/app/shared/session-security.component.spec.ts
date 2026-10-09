import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { SessionSecurityComponent } from './session-security.component';

describe('Session security',()=>{
 let component:SessionSecurityComponent;let signOut:jasmine.Spy;let getUser:jasmine.Spy;
 beforeEach(()=>{
  signOut=jasmine.createSpy('signOut').and.resolveTo({error:null});
  getUser=jasmine.createSpy('getUser').and.resolveTo({data:{user:{id:'a'}},error:null});
  TestBed.configureTestingModule({providers:[{provide:AuthService,useValue:{user:signal({id:'a'}),client:{auth:{signOut,getUser}}}}]});
  component=TestBed.runInInjectionContext(()=>new SessionSecurityComponent());TestBed.tick();
 });
 afterEach(()=>TestBed.resetTestingModule());
 it('requires confirmation',async()=>{await component.revokeOthers();expect(signOut).not.toHaveBeenCalled();});
 it('revokes only other sessions',async()=>{component.confirm.set(true);await component.revokeOthers();expect(signOut).toHaveBeenCalledWith({scope:'others'});expect(component.success()).not.toBe('');expect(component.confirm()).toBeFalse();});
 it('does not revoke when identity validation fails',async()=>{getUser.and.resolveTo({data:{user:{id:'b'}},error:null});component.confirm.set(true);await component.revokeOthers();expect(signOut).not.toHaveBeenCalled();expect(component.error()).not.toBe('');});
 it('reports failed revocation without claiming success',async()=>{signOut.and.resolveTo({error:{message:'offline'}});component.confirm.set(true);await component.revokeOthers();expect(component.success()).toBe('');expect(component.error()).not.toBe('');expect(component.busy()).toBeFalse();});
});
