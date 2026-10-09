import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, signal } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { NotificationPreferencesComponent } from './notification-preferences.component';

describe('Notification preferences', () => {
  let component: NotificationPreferencesComponent;
  let user: ReturnType<typeof signal<any>>;
  let query: any;
  let response: any;
  beforeEach(() => {
    user = signal({ id: 'account-a' });
    response = { data: null, error: null };
    query = {};
    for (const method of ['select', 'eq', 'maybeSingle', 'upsert', 'single']) query[method] = jasmine.createSpy(method).and.returnValue(query);
    query.then = (resolve: any) => Promise.resolve(response).then(resolve);
    TestBed.configureTestingModule({providers: [
      {provide: PLATFORM_ID, useValue: 'server'},
      {provide: AuthService, useValue: {user, client: {from: () => query}}}
    ]});
    component = TestBed.runInInjectionContext(() => new NotificationPreferencesComponent());
    TestBed.tick();
  });
  afterEach(() => TestBed.resetTestingModule());
  it('defaults to enabled only after a successful account-scoped read', async () => {
    await component.load();
    expect(query.eq).toHaveBeenCalledWith('user_id', 'account-a');
    expect(component.loaded()).toBeTrue();
    expect(component.draft()).toEqual({assignments: true, completions: true});
  });
  it('saves confirmed values for the current account and can cancel drafts', async () => {
    await component.load();
    component.draft.set({assignments: false, completions: true});
    response = {data: {assignments: false, completions: true}, error: null};
    await component.save();
    expect(query.upsert).toHaveBeenCalledWith({user_id: 'account-a', assignments: false, completions: true}, {onConflict: 'user_id'});
    expect(component.dirty()).toBeFalse();
    component.draft.set({assignments: true, completions: true});
    component.cancel(); expect(component.draft().assignments).toBeFalse();
  });
  it('keeps failed reads disabled instead of pretending defaults were saved', async () => {
    response = {data: null, error: {message: 'offline'}};
    await component.load(); await component.save();
    expect(component.loaded()).toBeFalse(); expect(component.error()).not.toBe('');
    expect(query.upsert).not.toHaveBeenCalled();
  });
  it('ignores an old account response', async () => {
    let resolve!: (value: any) => void;
    query.then = (callback: any) => new Promise(r => {resolve = r;}).then(callback);
    const pending = component.load();
    await Promise.resolve();
    user.set({id: 'account-b'}); TestBed.tick();
    resolve({data: {assignments: false, completions: false}, error: null}); await pending;
    expect(component.loaded()).toBeFalse();
    expect(component.draft()).toEqual({assignments: true, completions: true});
  });
});
