import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi, type Mock, type Mocked } from "vitest";
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { AccountDeletionComponent } from './account-deletion.component';
describe('Account deletion', () => {
    let component: AccountDeletionComponent;
    let rpc: Mock;
    let getUser: Mock;
    const ready = { enabled: true, status: null, requestedAt: null, deleteAfter: null };
    beforeEach(async () => {
        rpc = vi.fn().mockName('rpc').mockResolvedValue({ data: ready, error: null });
        getUser = vi.fn().mockName('getUser').mockResolvedValue({ data: { user: { id: 'a' } }, error: null });
        TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { user: signal({ id: 'a' }), client: { rpc, auth: { getUser } } } }] });
        component = TestBed.runInInjectionContext(() => new AccountDeletionComponent());
        TestBed.tick();
        await Promise.resolve();
        rpc.mockClear();
    });
    afterEach(() => TestBed.resetTestingModule());
    function confirm() { component.confirm.set(true); component.acknowledged = true; component.confirmationText = 'SUPPRIMER'; }
    it('requires both confirmations', async () => {
        component.confirm.set(true);
        component.confirmationText = 'SUPPRIMER';
        await component.perform('request');
        expect(rpc).not.toHaveBeenCalled();
    });
    it('does not request when the feature is disabled', async () => {
        component.state.set({ ...ready, enabled: false });
        confirm();
        await component.perform('request');
        expect(rpc).not.toHaveBeenCalled();
    });
    it('verifies identity before requesting without sending a user id', async () => {
        confirm();
        await component.perform('request');
        expect(getUser).toHaveBeenCalled();
        expect(rpc).toHaveBeenCalledWith('taskboard_manage_account_deletion', { operation: 'request' });
        expect(component.success()).not.toBe('');
        expect(component.confirm()).toBe(false);
    });
    it('blocks a mismatched identity', async () => {
        getUser.mockResolvedValue({ data: { user: { id: 'b' } }, error: null });
        confirm();
        await component.perform('request');
        expect(rpc).not.toHaveBeenCalled();
        expect(component.error()).not.toBe('');
    });
    it('cancels pending requests', async () => {
        component.state.set({ ...ready, status: 'pending' });
        await component.perform('cancel');
        expect(rpc).toHaveBeenCalledWith('taskboard_manage_account_deletion', { operation: 'cancel' });
    });
    it('cannot cancel a processing request', async () => {
        component.state.set({ ...ready, status: 'processing' });
        await component.perform('cancel');
        expect(rpc).not.toHaveBeenCalled();
    });
    it('does not claim success on server rejection', async () => {
        rpc.mockResolvedValue({ data: null, error: { message: 'expired' } });
        confirm();
        await component.perform('request');
        expect(component.success()).toBe('');
        expect(component.error()).not.toBe('');
        expect(component.busy()).toBe(false);
    });
});
