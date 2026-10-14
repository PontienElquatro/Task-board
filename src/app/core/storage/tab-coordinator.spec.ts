import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi, type Mock, type Mocked } from "vitest";
import { validNotice, withWorkspaceLock } from './tab-coordinator';
describe('Tab coordination', () => {
    it('uses an account-scoped exclusive lock', async () => {
        const work = vi.fn().mockName('work').mockResolvedValue('done');
        const request = vi.fn().mockName('request').mockImplementation((_name, _options, callback) => callback());
        expect(await withWorkspaceLock('account-a', work, { request } as unknown as LockManager)).toBe('done');
        expect(request.mock.lastCall![0]).toBe('maat-cloud-sync:account-a');
        expect(request.mock.lastCall![1]).toEqual({ mode: 'exclusive' });
    });
    it('keeps the CAS workflow usable when Web Locks are unavailable', async () => {
        expect(await withWorkspaceLock('account-a', async () => 42, null)).toBe(42);
    });
    it('accepts only well-formed account notifications', () => {
        expect(validNotice({ account: 'a', writer: 'b' })).toBe(true);
        expect(validNotice({ account: 1, writer: 'b' })).toBe(false);
        expect(validNotice(null)).toBe(false);
    });
});
