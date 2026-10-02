import { Task } from '../../models';
import { normalizeTasks } from '../../models/task-utils';
import { BRAND } from '../brand';

export function createTaskBackup(tasks: readonly Task[]) {
  return {app: BRAND.backupId, version: 2, exportedAt: new Date().toISOString(), tasks};
}

export function readTaskBackup(input: unknown): Task[] {
  if (Array.isArray(input)) return normalizeTasks(input);
  if (!input || typeof input !== 'object') throw new Error('Format de sauvegarde non reconnu.');
  const data = input as Record<string,unknown>;
  if ((data['app'] === 'MyTaskBoard' || data['app'] === BRAND.backupId) && data['version'] === 2) {
    return normalizeTasks(data['tasks']);
  }
  if (data['app'] === BRAND.backupId && data['version'] === 1 && data['data'] && typeof data['data'] === 'object') {
    const workspace = data['data'] as Record<string,unknown>;
    if (Array.isArray(workspace['mytaskboard_tasks'])) return normalizeTasks(workspace['mytaskboard_tasks']);
  }
  throw new Error('Format de sauvegarde non reconnu.');
}
