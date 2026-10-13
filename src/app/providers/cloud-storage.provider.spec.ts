import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi, type Mock, type Mocked } from "vitest";
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CloudStorageProvider } from './cloud-storage.provider';
import { AuthService } from '../services/auth.service';
import { DEVICE_CHECKPOINTS } from '../core/storage/indexed-checkpoints';
import { WORKSPACE_LOCKS } from '../core/storage/tab-coordinator';
describe('Cloud recovery safety', () => {
    let cloud: CloudStorageProvider;
    let user: ReturnType<typeof signal<{
        id: string;
    } | null>>;
    let read: Mock;
    let write: Mock;
    let checkpoint: Mock;
    let list: Mock;
    const id = 'maat-unit-test';
    const cacheKey = 'mytaskboard_cloud_' + id;
    const backupKey = 'maat_recovery_' + id;
    async function settle() { for (let i = 0; i < 8; i++)
        await Promise.resolve(); }
    beforeEach(async () => {
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(backupKey);
        user = signal<{
            id: string;
        } | null>(null);
        read = vi.fn().mockName('read').mockResolvedValue({ data: { revision: 1, data: { items: ['original'] } }, error: null });
        write = vi.fn().mockName('rpc').mockResolvedValue({ data: 3, error: null });
        checkpoint = vi.fn().mockName('checkpoint').mockResolvedValue(undefined);
        list = vi.fn().mockName('list').mockResolvedValue([]);
        const query = { select: () => query, eq: () => query, maybeSingle: () => read() };
        TestBed.configureTestingModule({ providers: [
                { provide: DEVICE_CHECKPOINTS, useValue: { put: checkpoint, list } },
                { provide: WORKSPACE_LOCKS, useValue: null },
                { provide: AuthService, useValue: {
                        initializing: signal(false), user, client: { from: () => query, rpc: write }
                    } }
            ] });
        cloud = TestBed.inject(CloudStorageProvider);
        TestBed.flushEffects();
        user.set({ id });
        TestBed.flushEffects();
        await settle();
        vi.spyOn(window, 'confirm').mockReturnValue(true);
    });
    afterEach(() => {
        TestBed.resetTestingModule();
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(backupKey);
        for (const key of Object.keys(localStorage))
            if (key.startsWith(cacheKey + '_draft_'))
                localStorage.removeItem(key);
    });
    it('retains an independent pending journal before the cloud write', () => {
        cloud.setItem('items', ['draft']);
        const journals = Object.keys(localStorage).filter(key => key.startsWith(cacheKey + '_draft_'));
        expect(journals.length).toBe(1);
        expect(JSON.parse(localStorage.getItem(journals[0])!).data.items).toEqual(['draft']);
        expect(JSON.parse(localStorage.getItem(journals[0])!).pending).toBe(true);
    });
    it('ignores a delayed read after signing out', async () => {
        let finish!: (value: unknown) => void;
        read.mockReturnValue(new Promise(resolve => finish = resolve));
        const syncing = cloud.sync();
        await settle();
        user.set(null);
        TestBed.flushEffects();
        finish({ data: { revision: 99, data: { items: ['private old account'] } }, error: null });
        await syncing;
        expect(cloud.getItem('items')).toBeNull();
        expect(cloud.status()).toBe('Mode local');
    });
    it('does not acknowledge pending data on a rejected CAS write', async () => {
        cloud.setItem('items', ['pending']);
        write.mockResolvedValue({ data: null, error: { code: '40001' } });
        await cloud.sync();
        expect(cloud.getItem('items')).toEqual(['pending']);
        expect(JSON.parse(localStorage.getItem(cacheKey)!).pending).toBe(true);
        expect(cloud.status()).toContain('nouvelle comparaison');
    });
    it('retains pending changes on a PostgREST PT409 conflict', async () => {
        cloud.setItem('items', ['pending']);
        write.mockResolvedValue({ data: null, error: { code: 'PT409' } });
        await cloud.sync();
        expect(cloud.getItem('items')).toEqual(['pending']);
        expect(JSON.parse(localStorage.getItem(cacheKey)!).pending).toBe(true);
        expect(cloud.status()).toContain('nouvelle comparaison');
    });
    it('does not send simultaneous writes from the same provider', async () => {
        let finish!: (value: unknown) => void;
        cloud.setItem('items', ['pending']);
        write.mockReturnValue(new Promise(resolve => finish = resolve));
        const first = cloud.sync();
        await settle();
        await cloud.sync();
        expect(write.mock.calls.length).toBe(1);
        finish({ data: 2, error: null });
        await first;
    });
    it('keeps normal storage usable when IndexedDB fails', async () => {
        checkpoint.mockRejectedValue(new Error('IndexedDB unavailable'));
        cloud.setItem('items', ['safe']);
        for (let i = 0; i < 30; i++)
            await Promise.resolve();
        expect(cloud.getItem('items')).toEqual(['safe']);
        expect(cloud.localBackupStatus()).toContain('indisponible');
    });
    it('rejects stale local edits instead of overwriting another tab', () => {
        user.set(null);
        TestBed.flushEffects();
        const key = 'maat-local-stale-test';
        try {
            localStorage.removeItem(key);
            cloud.getItem(key);
            localStorage.setItem(key, JSON.stringify(['other tab']));
            expect(() => cloud.setItem(key, ['stale form'])).toThrowError(/autre version/);
            expect(JSON.parse(localStorage.getItem(key)!)).toEqual(['other tab']);
        }
        finally {
            localStorage.removeItem(key);
        }
    });
    it('keeps the local version and conflict when recovery fetch fails', async () => {
        cloud.setItem('items', ['unsynchronised']);
        cloud.conflict.set(true);
        read.mockResolvedValue({ data: null, error: { message: 'offline' } });
        await cloud.reloadCloud();
        expect(cloud.getItem('items')).toEqual(['unsynchronised']);
        expect(cloud.conflict()).toBe(true);
        const backup = JSON.parse(localStorage.getItem(backupKey)!);
        expect(backup.data.items).toEqual(['unsynchronised']);
    });
    it('backs up pending changes before replacing them with the cloud version', async () => {
        cloud.setItem('items', ['unsynchronised']);
        cloud.conflict.set(true);
        read.mockResolvedValue({ data: { revision: 2, data: { items: ['remote'] } }, error: null });
        await cloud.reloadCloud();
        expect(cloud.getItem('items')).toEqual(['remote']);
        expect(cloud.conflict()).toBe(false);
        expect(JSON.parse(localStorage.getItem(backupKey)!).data.items).toEqual(['unsynchronised']);
    });
    it('does not fetch or replace anything if the safety backup cannot be stored', async () => {
        cloud.setItem('items', ['unsynchronised']);
        cloud.conflict.set(true);
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('quota');
        });
        read.mockClear();
        await cloud.reloadCloud();
        expect(read).not.toHaveBeenCalled();
        expect(cloud.getItem('items')).toEqual(['unsynchronised']);
        expect(cloud.conflict()).toBe(true);
    });
    it('automatically combines edits to separate tasks and writes against the latest revision', async () => {
        const a = { id: 'a', title: 'A' }, b = { id: 'b', title: 'B' };
        read.mockResolvedValue({ data: { revision: 1, data: { mytaskboard_tasks: [a, b] } }, error: null });
        await cloud.sync();
        cloud.setItem('mytaskboard_tasks', [{ ...a, title: 'Local' }, b]);
        read.mockResolvedValue({ data: { revision: 2, data: { mytaskboard_tasks: [a, { ...b, title: 'Remote' }] } }, error: null });
        await cloud.sync();
        expect(cloud.conflict()).toBe(false);
        expect(cloud.getItem('mytaskboard_tasks')).toEqual([{ ...a, title: 'Local' }, { ...b, title: 'Remote' }]);
        expect(write.mock.lastCall![1].expected_revision).toBe(2);
        expect(JSON.parse(localStorage.getItem(backupKey)!).data.mytaskboard_tasks[0].title).toBe('Local');
    });
    it('blocks a same-task conflict until a choice is made, preserving the local backup', async () => {
        const a = { id: 'a', title: 'A' };
        read.mockResolvedValue({ data: { revision: 1, data: { mytaskboard_tasks: [a] } }, error: null });
        await cloud.sync();
        cloud.setItem('mytaskboard_tasks', [{ ...a, title: 'Local' }]);
        read.mockResolvedValue({ data: { revision: 2, data: { mytaskboard_tasks: [{ ...a, title: 'Remote' }] } }, error: null });
        await cloud.sync();
        expect(cloud.conflict()).toBe(true);
        expect(write).not.toHaveBeenCalled();
        const token = cloud.conflictItems()[0].token;
        await cloud.resolveConflicts({ [token]: 'remote' });
        expect(cloud.conflict()).toBe(false);
        expect(cloud.getItem('mytaskboard_tasks')).toEqual([{ ...a, title: 'Remote' }]);
        expect(JSON.parse(localStorage.getItem(backupKey)!).data.mytaskboard_tasks[0].title).toBe('Local');
    });
    async function exportedContent() {
        const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:unit-test');
        vi.spyOn(HTMLAnchorElement.prototype, 'click');
        await cloud.exportDeviceCopies();
        expect(create).toHaveBeenCalled();
        return JSON.parse(await (create.mock.lastCall![0] as Blob).text());
    }
    it('blocks automatic upload of different pending recovered drafts', async () => {
        user.set(null);
        TestBed.flushEffects();
        localStorage.removeItem(cacheKey);
        list.mockResolvedValue([
            { account: id, writer: 'one', updatedAt: '2026-10-12', envelope: { revision: 1, data: { items: ['one'] }, pending: true } },
            { account: id, writer: 'two', updatedAt: '2026-10-12', envelope: { revision: 1, data: { items: ['two'] }, pending: true } }
        ]);
        read.mockClear();
        write.mockClear();
        user.set({ id });
        TestBed.flushEffects();
        await settle();
        expect(cloud.conflict()).toBe(true);
        expect(cloud.ready()).toBe(true);
        expect(cloud.getItem('items')).toEqual(['one']);
        expect(read).not.toHaveBeenCalled();
        expect(write).not.toHaveBeenCalled();
    });
    it('exports the displayed workspace even when IndexedDB is unavailable', async () => {
        list.mockRejectedValue(new Error('offline storage'));
        const content = await exportedContent();
        expect(content.copies[0].envelope.data.items).toEqual(['original']);
        expect(content.unavailable).toContain('copies IndexedDB');
        expect(cloud.exportDownload()?.filename).toContain('maat-copies-appareil');
    });
    it('exports memory when journal enumeration fails', async () => {
        vi.spyOn(Storage.prototype, 'key').mockImplementation(() => {
            throw new Error('unavailable');
        });
        const content = await exportedContent();
        expect(content.copies[0].envelope.data.items).toEqual(['original']);
        expect(content.unavailable).toContain('brouillons localStorage');
    });
    it('ignores malformed checkpoints without dropping the current workspace', async () => {
        list.mockResolvedValue([{ account: id, envelope: { revision: -1, data: {}, pending: false } }]);
        const content = await exportedContent();
        expect(content.copies.length).toBe(1);
        expect(content.copies[0].envelope.data.items).toEqual(['original']);
        expect(content.unavailable).toContain('copie IndexedDB illisible');
    });
    it('bounds a stalled IndexedDB read', async () => {
        vi.useFakeTimers();
        try {
            list.mockReturnValue(new Promise(() => { }));
            const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:unit-test');
            vi.spyOn(HTMLAnchorElement.prototype, 'click');
            const exporting = cloud.exportDeviceCopies();
            await settle();
            vi.advanceTimersByTime(5001);
            await exporting;
            expect(create).toHaveBeenCalled();
            const content = JSON.parse(await (create.mock.lastCall![0] as Blob).text());
            expect(content.copies[0].envelope.data.items).toEqual(['original']);
            expect(content.unavailable).toContain('copies IndexedDB');
        }
        finally {
            vi.useRealTimers();
        }
    });
    it('cancels an export when the account changes while reading checkpoints', async () => {
        let finish!: (value: unknown) => void;
        list.mockReturnValue(new Promise(resolve => finish = resolve));
        const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:unit-test');
        vi.spyOn(HTMLAnchorElement.prototype, 'click');
        const exporting = cloud.exportDeviceCopies();
        await settle();
        user.set(null);
        TestBed.flushEffects();
        finish([]);
        await exporting;
        expect(create).not.toHaveBeenCalled();
        expect(cloud.exportDownload()).toBeNull();
    });
    it('rejects stale local deletion instead of removing another tab version', () => {
        user.set(null);
        TestBed.flushEffects();
        const key = 'maat-local-stale-delete-test';
        try {
            localStorage.removeItem(key);
            cloud.getItem(key);
            localStorage.setItem(key, JSON.stringify(['other tab']));
            expect(() => cloud.removeItem(key)).toThrowError(/autre version/);
            expect(JSON.parse(localStorage.getItem(key)!)).toEqual(['other tab']);
        }
        finally {
            localStorage.removeItem(key);
        }
    });
});
