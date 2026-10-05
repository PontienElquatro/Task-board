import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, signal } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { NotificationsComponent } from './notifications.component';

describe('Notification dismissal',()=>{
 let component:NotificationsComponent;
 let query:any;
 beforeEach(()=>{
  query={update:jasmine.createSpy('update'),eq:jasmine.createSpy('eq'),is:jasmine.createSpy('is'),lte:jasmine.createSpy('lte')};
  for(const name of ['update','eq','is','lte'])query[name].and.returnValue(query);
  query.then=(resolve:any)=>Promise.resolve({error:null}).then(resolve);
  TestBed.configureTestingModule({providers:[{provide:PLATFORM_ID,useValue:'server'},{provide:AuthService,useValue:{user:signal({id:'account-a'}),client:{from:()=>query}}}]});
  component=TestBed.runInInjectionContext(()=>new NotificationsComponent());
  spyOn(component,'load').and.resolveTo();
 });
 it('requires confirmation before clearing all notifications',async()=>{
  await component.dismiss();expect(query.update).not.toHaveBeenCalled();
 });
 it('scopes global dismissal to the account and a cutoff',async()=>{
  component.confirmClear.set(true);await component.dismiss();
  expect(query.eq).toHaveBeenCalledWith('user_id','account-a');
  expect(query.is).toHaveBeenCalledWith('dismissed_at',null);
  expect(query.lte).toHaveBeenCalledWith('created_at',jasmine.any(String));
  expect(component.load).toHaveBeenCalled();expect(component.busy()).toBeFalse();
 });
 it('marks all unread alerts without dismissing them',async()=>{
  component.unreadCount.set(72);await component.readAll();
  expect(query.update).toHaveBeenCalledWith({read_at:jasmine.any(String)});
  expect(query.eq).toHaveBeenCalledWith('user_id','account-a');
  expect(query.is).toHaveBeenCalledWith('read_at',null);
  expect(query.is).toHaveBeenCalledWith('dismissed_at',null);
  expect(query.lte).toHaveBeenCalledWith('created_at',jasmine.any(String));
  expect(component.load).toHaveBeenCalled();expect(component.busy()).toBeFalse();
 });
 it('does nothing when there are no unread alerts',async()=>{
  await component.readAll();expect(query.update).not.toHaveBeenCalled();
 });
 it('switches filters and refreshes the server result',()=>{
  component.setFilter('unread');expect(component.filter()).toBe('unread');expect(component.load).toHaveBeenCalledTimes(1);
  component.setFilter('unread');expect(component.load).toHaveBeenCalledTimes(1);
 });
 it('retains the list and reports errors',async()=>{
  query.then=(resolve:any)=>Promise.resolve({error:{message:'offline'}}).then(resolve);
  component.confirmClear.set(true);await component.dismiss();
  expect(component.load).not.toHaveBeenCalled();expect(component.error()).toContain('conservées');
  expect(component.busy()).toBeFalse();
 });
});
