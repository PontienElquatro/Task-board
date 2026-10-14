export interface RecoveryBackup {
  app: 'Maat';
  version: 1;
  accountId: string;
  createdAt: string;
  revision: number;
  data: Record<string, unknown>;
}

/** One separate, account-scoped recovery copy; never contains auth tokens. */
export function saveRecoveryBackup(
  storage: Pick<Storage, 'setItem'>,
  accountId: string,
  envelope: {revision: number; data: Record<string, unknown>}
): RecoveryBackup {
  const backup: RecoveryBackup = {
    app: 'Maat', version: 1, accountId, createdAt: new Date().toISOString(),
    revision: envelope.revision, data: envelope.data
  };
  // A failed write must abort recovery, not discard unsynchronised changes.
  storage.setItem('maat_recovery_' + accountId, JSON.stringify(backup));
  return backup;
}
