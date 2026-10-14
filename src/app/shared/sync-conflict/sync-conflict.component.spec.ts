import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi, type Mock, type Mocked } from "vitest";
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SyncConflictComponent } from './sync-conflict.component';
import { CloudStorageProvider } from '../../providers/cloud-storage.provider';
describe('Conflict comparison panel', () => {
    const token = 'task-one';
    let resolve: Mock;
    beforeEach(() => {
        resolve = vi.fn().mockName('resolve').mockResolvedValue(undefined);
        TestBed.configureTestingModule({ imports: [SyncConflictComponent], providers: [{ provide: CloudStorageProvider, useValue: {
                        conflictItems: signal([{ token, key: 'mytaskboard_tasks', id: 'one', label: 'Tâche', local: { title: 'Locale' }, remote: { title: 'Cloud' } }]),
                        resolveConflicts: resolve, exportRecoveryBackup: vi.fn().mockName('export')
                    } }] });
    });
    it('requires an explicit choice before applying', () => {
        const fixture = TestBed.createComponent(SyncConflictComponent);
        fixture.detectChanges();
        expect(fixture.componentInstance.complete()).toBe(false);
        fixture.componentInstance.choose(token, 'remote');
        expect(fixture.componentInstance.complete()).toBe(true);
    });
    it('passes the chosen version to the storage provider', async () => {
        const fixture = TestBed.createComponent(SyncConflictComponent);
        fixture.detectChanges();
        fixture.componentInstance.choose(token, 'local');
        await fixture.componentInstance.apply();
        expect(resolve).toHaveBeenCalledWith({ [token]: 'local' });
    });
    it('renders human-readable task states instead of internal identifiers', () => {
        const fixture = TestBed.createComponent(SyncConflictComponent);
        const preview = fixture.componentInstance.preview({ id: 'internal', title: 'Tâche', status: 'todo', priority: 'high' });
        expect(preview).toContain('Statut : À faire');
        expect(preview).not.toContain('internal');
    });
});
