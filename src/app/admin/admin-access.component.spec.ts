import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi, type Mock, type Mocked } from "vitest";
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { AdminAccessComponent } from './admin-access.component';
describe('Admin access management', () => {
    let component: AdminAccessComponent;
    let invoke: Mock;
    let signIn: Mock;
    beforeEach(() => {
        invoke = vi.fn().mockResolvedValue({ data: { members: [], events: [] }, error: null });
        signIn = vi.fn().mockResolvedValue({ error: null });
        TestBed.configureTestingModule({ imports: [AdminAccessComponent], providers: [{ provide: AuthService, useValue: {
                        user: signal({ id: 'principal', email: 'principal@example.invalid' }), client: { functions: { invoke }, auth: { signInWithPassword: signIn } }
                    } }] });
        component = TestBed.createComponent(AdminAccessComponent).componentInstance;
        component.access = { isPrincipal: true, permissions: [], fresh: false, version: 1 };
    });
    it('requires a target, reason and explicit confirmation', () => {
        component.target = 'target';
        component.reason = 'Enough reason text';
        expect(component.canChange()).toBe(false);
        component.confirmed = true;
        expect(component.canChange()).toBe(true);
    });
    it('excludes the principal, unconfirmed and suspended accounts', async () => {
        invoke.mockResolvedValue({ data: { members: [{ id: 'principal', principal: true, permissions: [], email: 'p', version: 1 }] } });
        await component.load();
        component.users = [{ id: 'principal', email: 'p', confirmed: true }, { id: 'u', email: 'u', confirmed: false }, { id: 's', email: 's', confirmed: true, suspended: true }, { id: 'ok', email: 'ok', confirmed: true }];
        expect(component.eligibleUsers().map(u => u.id)).toEqual(['ok']);
    });
    it('sends the password only to Auth and clears it', async () => {
        component.password = 'test-only-password';
        await component.reauthenticate();
        expect(signIn).toHaveBeenCalledWith({ email: 'principal@example.invalid', password: 'test-only-password' });
        expect(invoke).not.toHaveBeenCalled();
        expect(component.password).toBe('');
    });
    it('does not call management without confirmation', async () => {
        component.target = 'target';
        component.reason = 'Enough reason text';
        await component.change('grant');
        expect(invoke).not.toHaveBeenCalled();
    });
});
