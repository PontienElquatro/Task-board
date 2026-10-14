import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi, type Mock, type Mocked } from "vitest";
import { checkpointRecovery, validEnvelope } from './checkpoint-recovery';
import { DeviceCheckpoint } from './workspace-envelope';
describe('Checkpoint recovery', () => {
    const copy = (writer: string, data: Record<string, unknown>, pending = true, account = 'a'): DeviceCheckpoint => ({ writer, account, updatedAt: '2026-10-12', envelope: { revision: 1, data, pending, base: {} } });
    it('prefers a pending draft but marks distinct drafts ambiguous', () => {
        const result = checkpointRecovery([copy('clean', {}, false), copy('one', { items: ['one'] }), copy('two', { items: ['two'] })], 'a');
        expect(result?.envelope.data['items']).toEqual(['one']);
        expect(result?.ambiguous).toBe(true);
    });
    it('does not confuse property order with different data', () => {
        expect(checkpointRecovery([copy('one', { a: 1, b: 2 }), copy('two', { b: 2, a: 1 })], 'a')?.ambiguous).toBe(false);
    });
    it('ignores another account and malformed envelopes', () => {
        expect(checkpointRecovery([copy('private', { secret: true }, true, 'b'), { ...copy('bad', {}), envelope: { revision: -1, data: {}, pending: true } }], 'a')).toBeUndefined();
    });
    it('does not mutate stored copies when the recovered state is edited', () => {
        const original = copy('one', { items: ['original'] });
        const recovered = checkpointRecovery([original], 'a')!;
        (recovered.envelope.data['items'] as string[]).push('edit');
        expect(original.envelope.data['items']).toEqual(['original']);
    });
    it('rejects unsafe revisions, array data and invalid bases', () => {
        expect(validEnvelope({ revision: Number.MAX_SAFE_INTEGER + 1, data: {}, pending: false })).toBe(false);
        expect(validEnvelope({ revision: 0, data: [], pending: false })).toBe(false);
        expect(validEnvelope({ revision: 1, data: {}, pending: true, base: null })).toBe(false);
    });
});
