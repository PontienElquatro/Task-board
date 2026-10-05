import type { Status } from '../models';

interface Step { id: string; completed: boolean; }

/** Only checklist changes drive status; metadata edits and manual status stay intact. */
export function statusAfterChecklist(previous: readonly Step[], next: readonly Step[], status: Status): Status {
  const changed = previous.length !== next.length ||
    next.some(step => !previous.some(old => old.id === step.id && old.completed === step.completed));
  if (!changed || next.length === 0) return status;
  if (next.every(step => step.completed)) return 'done';
  if (status === 'done' || next.some(step => step.completed)) return 'in-progress';
  return status;
}
