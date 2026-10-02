import { saveRecoveryBackup } from './recovery-backup';

describe('Recovery backup', () => {
  it('keeps an account-scoped copy with the original revision and data', () => {
    const storage = jasmine.createSpyObj('storage', ['setItem']);
    const data = {mytaskboard_tasks: [{id:'one', title:'À protéger'}]};
    const backup = saveRecoveryBackup(storage, 'account-a', {revision:4, data});
    expect(storage.setItem).toHaveBeenCalledWith('maat_recovery_account-a', JSON.stringify(backup));
    expect(backup.revision).toBe(4);
    expect(backup.data).toEqual(data);
    expect(backup.app).toBe('Maat');
  });
  it('does not swallow a quota error', () => {
    const storage = jasmine.createSpyObj('storage', ['setItem']);
    storage.setItem.and.throwError('quota');
    expect(() => saveRecoveryBackup(storage, 'account-a', {revision:2,data:{}})).toThrowError('quota');
  });
});
