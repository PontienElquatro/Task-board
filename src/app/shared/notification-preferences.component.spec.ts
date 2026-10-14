import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi, type Mock, type Mocked } from "vitest";
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
        for (const method of ['select', 'eq', 'maybeSingle', 'upsert', 'single'])
            query[method] = vi.fn().mockName(method).mockReturnValue(query);
        query.then = (resolve: any) => Promise.resolve(response).then(resolve);
        TestBed.configureTestingModule({ providers: [
                { provide: PLATFORM_ID, useValue: 'server' },
                { provide: AuthService, useValue: { user, client: { from: () => query } } }
            ] });
        component = TestBed.runInInjectionContext(() => new NotificationPreferencesComponent());
        TestBed.tick();
    });
    afterEach(() => TestBed.resetTestingModule());
    it('defaults to enabled only after a successful account-scoped read', async () => {
        await component.load();
        expect(query.eq).toHaveBeenCalledWith('user_id', 'account-a');
        expect(component.loaded()).toBe(true);
        expect(component.draft()).toEqual({ assignments: true, completions: true, email_assignments: false });
    });
    it('saves confirmed values for the current account and can cancel drafts', async () => {
        await component.load();
        component.draft.set({ assignments: false, completions: true, email_assignments: false });
        response = { data: { assignments: false, completions: true, email_assignments: false }, error: null };
        await component.save();
        expect(query.upsert).toHaveBeenCalledWith({ user_id: 'account-a', assignments: false, completions: true, email_assignments: false }, { onConflict: 'user_id' });
        expect(component.dirty()).toBe(false);
        component.draft.set({ assignments: true, completions: true, email_assignments: false });
        component.cancel();
        expect(component.draft().assignments).toBe(false);
    });
    it('keeps failed reads disabled instead of pretending defaults were saved', async () => {
        response = { data: null, error: { message: 'offline' } };
        await component.load();
        await component.save();
        expect(component.loaded()).toBe(false);
        expect(component.error()).not.toBe('');
        expect(query.upsert).not.toHaveBeenCalled();
    });
    it('ignores an old account response', async () => {
        let resolve!: (value: any) => void;
        query.then = (callback: any) => new Promise(r => { resolve = r; }).then(callback);
        const pending = component.load();
        await Promise.resolve();
        user.set({ id: 'account-b' });
        TestBed.tick();
        resolve({ data: { assignments: false, completions: false, email_assignments: true }, error: null });
        await pending;
        expect(component.loaded()).toBe(false);
        expect(component.draft()).toEqual({ assignments: true, completions: true, email_assignments: false });
    });
    it('saves email opt-in independently of the bell preferences', async () => {
        await component.load();
        component.change('email_assignments', { target: { checked: true } } as unknown as Event);
        expect(component.dirty()).toBe(true);
        response = { data: { assignments: true, completions: true, email_assignments: true }, error: null };
        await component.save();
        expect(query.upsert).toHaveBeenCalledWith({ user_id: 'account-a', assignments: true, completions: true, email_assignments: true }, { onConflict: 'user_id' });
        expect(component.dirty()).toBe(false);
        component.change('email_assignments', { target: { checked: false } } as unknown as Event);
        component.cancel();
        expect(component.draft().email_assignments).toBe(true);
    });
    it('does not claim email preferences are saved after an error', async () => {
        await component.load();
        component.draft.update(value => ({ ...value, email_assignments: true }));
        response = { data: null, error: { message: 'offline' } };
        await component.save();
        expect(component.success()).toBe('');
        expect(component.error()).not.toBe('');
        expect(component.dirty()).toBe(true);
    });
    it('rejects incomplete server responses instead of silently enabling email', async () => {
        response = { data: { assignments: true, completions: true }, error: null };
        await component.load();
        expect(component.loaded()).toBe(false);
        expect(component.draft().email_assignments).toBe(false);
        expect(component.error()).not.toBe('');
    });
});
