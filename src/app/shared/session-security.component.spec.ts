import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi, type Mock, type Mocked } from "vitest";
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { SessionSecurityComponent } from './session-security.component';
describe('Session security', () => {
    let component: SessionSecurityComponent;
    let signOut: Mock;
    let getUser: Mock;
    beforeEach(() => {
        signOut = vi.fn().mockName('signOut').mockResolvedValue({ error: null });
        getUser = vi.fn().mockName('getUser').mockResolvedValue({ data: { user: { id: 'a' } }, error: null });
        TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { user: signal({ id: 'a' }), client: { auth: { signOut, getUser } } } }] });
        component = TestBed.runInInjectionContext(() => new SessionSecurityComponent());
        TestBed.tick();
    });
    afterEach(() => TestBed.resetTestingModule());
    it('requires confirmation', async () => { await component.revokeOthers(); expect(signOut).not.toHaveBeenCalled(); });
    it('revokes only other sessions', async () => { component.confirm.set(true); await component.revokeOthers(); expect(signOut).toHaveBeenCalledWith({ scope: 'others' }); expect(component.success()).not.toBe(''); expect(component.confirm()).toBe(false); });
    it('does not revoke when identity validation fails', async () => { getUser.mockResolvedValue({ data: { user: { id: 'b' } }, error: null }); component.confirm.set(true); await component.revokeOthers(); expect(signOut).not.toHaveBeenCalled(); expect(component.error()).not.toBe(''); });
    it('reports failed revocation without claiming success', async () => { signOut.mockResolvedValue({ error: { message: 'offline' } }); component.confirm.set(true); await component.revokeOthers(); expect(component.success()).toBe(''); expect(component.error()).not.toBe(''); expect(component.busy()).toBe(false); });
});
