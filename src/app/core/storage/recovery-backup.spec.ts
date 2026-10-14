import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi, type Mock, type Mocked } from "vitest";
import { saveRecoveryBackup } from './recovery-backup';
describe('Recovery backup', () => {
    it('keeps an account-scoped copy with the original revision and data', () => {
        const storage = {
            setItem: vi.fn()
        };
        const data = { mytaskboard_tasks: [{ id: 'one', title: 'À protéger' }] };
        const backup = saveRecoveryBackup(storage, 'account-a', { revision: 4, data });
        expect(storage.setItem).toHaveBeenCalledWith('maat_recovery_account-a', JSON.stringify(backup));
        expect(backup.revision).toBe(4);
        expect(backup.data).toEqual(data);
        expect(backup.app).toBe('Maat');
    });
    it('does not swallow a quota error', () => {
        const storage = {
            setItem: vi.fn()
        };
        storage.setItem.mockImplementation(() => {
            throw new Error('quota');
        });
        expect(() => saveRecoveryBackup(storage, 'account-a', { revision: 2, data: {} })).toThrowError('quota');
    });
});
