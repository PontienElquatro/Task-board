import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi, type Mock, type Mocked } from "vitest";
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, signal } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { NotificationsComponent } from './notifications.component';
describe('Notification filter isolation', () => {
    afterEach(() => TestBed.resetTestingModule());
    it('does not reinitialize the account effect when the filter changes', () => {
        const channel: any = { on: () => channel, subscribe: () => channel };
        const createChannel = vi.fn().mockName('channel').mockReturnValue(channel);
        TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'browser' }, { provide: AuthService, useValue: { user: signal({ id: 'account-a' }), client: { channel: createChannel, removeChannel: () => Promise.resolve() } } }] });
        const component = TestBed.runInInjectionContext(() => new NotificationsComponent());
        vi.spyOn(component, 'load').mockImplementation(async () => { component.filter(); });
        TestBed.tick();
        component.setFilter('unread');
        TestBed.tick();
        expect(component.filter()).toBe('unread');
        expect(createChannel).toHaveBeenCalledTimes(1);
    });
});
describe('Notification dismissal', () => {
    let component: NotificationsComponent;
    let query: any;
    beforeEach(() => {
        query = { update: vi.fn().mockName('update'), eq: vi.fn().mockName('eq'), is: vi.fn().mockName('is'), lte: vi.fn().mockName('lte') };
        for (const name of ['update', 'eq', 'is', 'lte'])
            query[name].mockReturnValue(query);
        query.then = (resolve: any) => Promise.resolve({ error: null }).then(resolve);
        TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }, { provide: AuthService, useValue: { user: signal({ id: 'account-a' }), client: { from: () => query } } }] });
        component = TestBed.runInInjectionContext(() => new NotificationsComponent());
        vi.spyOn(component, 'load').mockResolvedValue(undefined);
    });
    it('requires confirmation before clearing all notifications', async () => {
        await component.dismiss();
        expect(query.update).not.toHaveBeenCalled();
    });
    it('scopes global dismissal to the account and a cutoff', async () => {
        component.confirmClear.set(true);
        await component.dismiss();
        expect(query.eq).toHaveBeenCalledWith('user_id', 'account-a');
        expect(query.is).toHaveBeenCalledWith('dismissed_at', null);
        expect(query.lte).toHaveBeenCalledWith('created_at', expect.any(String));
        expect(component.load).toHaveBeenCalled();
        expect(component.busy()).toBe(false);
    });
    it('marks all unread alerts without dismissing them', async () => {
        component.unreadCount.set(72);
        await component.readAll();
        expect(query.update).toHaveBeenCalledWith({ read_at: expect.any(String) });
        expect(query.eq).toHaveBeenCalledWith('user_id', 'account-a');
        expect(query.is).toHaveBeenCalledWith('read_at', null);
        expect(query.is).toHaveBeenCalledWith('dismissed_at', null);
        expect(query.lte).toHaveBeenCalledWith('created_at', expect.any(String));
        expect(component.load).toHaveBeenCalled();
        expect(component.busy()).toBe(false);
    });
    it('does nothing when there are no unread alerts', async () => {
        await component.readAll();
        expect(query.update).not.toHaveBeenCalled();
    });
    it('switches filters and refreshes the server result', () => {
        component.setFilter('unread');
        expect(component.filter()).toBe('unread');
        expect(component.load).toHaveBeenCalledTimes(1);
        component.setFilter('unread');
        expect(component.load).toHaveBeenCalledTimes(1);
    });
    it('retains the list and reports errors', async () => {
        query.then = (resolve: any) => Promise.resolve({ error: { message: 'offline' } }).then(resolve);
        component.confirmClear.set(true);
        await component.dismiss();
        expect(component.load).not.toHaveBeenCalled();
        expect(component.error()).toContain('conservées');
        expect(component.busy()).toBe(false);
    });
});
