import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { adminRouteGuard } from './admin-route.guard';

describe('Admin routes',()=>{
  let auth:{initializing:ReturnType<typeof signal<boolean>>;user:ReturnType<typeof signal<{id:string}|null>>;isAdmin:jasmine.Spy};
  beforeEach(()=>{
    auth={initializing:signal(false),user:signal<{id:string}|null>({id:'test-account'}),isAdmin:jasmine.createSpy().and.resolveTo(true)};
    TestBed.configureTestingModule({providers:[provideRouter([]),{provide:AuthService,useValue:auth}]});
  });
  async function check(){const pending=TestBed.runInInjectionContext(()=>adminRouteGuard({} as ActivatedRouteSnapshot,{} as RouterStateSnapshot)) as Promise<boolean|UrlTree>;TestBed.flushEffects();return pending;}
  it('allows a server-confirmed admin',async()=>{expect(await check()).toBeTrue();});
  it('routes standard accounts to the explicit refusal page',async()=>{auth.isAdmin.and.resolveTo(false);expect(TestBed.inject(Router).serializeUrl(await check() as UrlTree)).toBe('/access-denied');});
  it('routes guests to login without making an admin request',async()=>{auth.user.set(null);expect(TestBed.inject(Router).serializeUrl(await check() as UrlTree)).toBe('/login');expect(auth.isAdmin).not.toHaveBeenCalled();});
  it('waits for session restoration before checking privileges',async()=>{auth.initializing.set(true);const pending=check();expect(auth.isAdmin).not.toHaveBeenCalled();auth.initializing.set(false);TestBed.flushEffects();expect(await pending).toBeTrue();});
});
