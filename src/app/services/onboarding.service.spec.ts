import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi, type Mock, type Mocked } from "vitest";
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, signal } from '@angular/core';
import { OnboardingService } from './onboarding.service';
import { AuthService } from './auth.service';
describe('OnboardingService', () => {
    let service: OnboardingService;
    let auth: any;
    beforeEach(() => {
        auth = { user: signal({ id: 'guide-test', user_metadata: {} }), initializing: signal(false),
            client: { auth: { updateUser: vi.fn().mockResolvedValue({ data: { user: { id: 'guide-test', user_metadata: { maat_guide_seen: true } } }, error: null }) } } };
        localStorage.removeItem('maat-guide-hidden:guide-test');
        TestBed.configureTestingModule({ providers: [OnboardingService, { provide: AuthService, useValue: auth }, { provide: PLATFORM_ID, useValue: 'browser' }] });
        service = TestBed.inject(OnboardingService);
    });
    afterEach(() => localStorage.removeItem('maat-guide-hidden:guide-test'));
    it('keeps the first visit open but saves it for future visits', async () => {
        service.enter();
        expect(service.hidden()).toBe(false);
        await Promise.resolve();
        await Promise.resolve();
        expect(auth.client.auth.updateUser).toHaveBeenCalledWith({ data: { maat_guide_seen: true } });
        service.enter();
        expect(service.hidden()).toBe(false);
        auth.user.set(null);
        service.enter();
        auth.user.set({ id: 'guide-test', user_metadata: { maat_guide_seen: true } });
        service.enter();
        expect(service.hidden()).toBe(true);
    });
    it('does not make repeated writes after completion', () => {
        auth.user.set({ id: 'guide-test', user_metadata: { maat_guide_seen: true } });
        service.enter();
        service.dismiss();
        service.dismiss();
        expect(auth.client.auth.updateUser).not.toHaveBeenCalled();
    });
    it('does not initialize while auth is loading', () => {
        auth.initializing.set(true);
        service.enter();
        expect(service.hidden()).toBe(true);
        expect(auth.client.auth.updateUser).not.toHaveBeenCalled();
    });
});
