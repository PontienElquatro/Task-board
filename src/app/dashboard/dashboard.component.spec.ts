import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi, type Mock, type Mocked } from "vitest";
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { DashboardComponent } from './dashboard.component';
import { DashboardService } from '../services/dashboard.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../providers/storage.provider';
describe('Vue d’ensemble — état vide', () => {
    it('propose une prochaine action plutôt que des graphiques à zéro', () => {
        // Real task/project services must see a genuinely empty, isolated store.
        const data = new Map<string, unknown>();
        const storage: StorageProvider = {
            getItem<T>(key: string): T | null { return (data.get(key) as T) ?? null; },
            setItem<T>(key: string, value: T) { data.set(key, value); },
            removeItem(key: string) { data.delete(key); },
        };
        TestBed.configureTestingModule({ imports: [DashboardComponent], providers: [provideRouter([]),
            { provide: STORAGE_PROVIDER, useValue: storage },
            { provide: DashboardService, useValue: { stats: signal({ total: 0, completed: 0, late: 0, progressPercentage: 0 }), distribution: signal([]), priorities: signal([]), goalsProgress: signal([]) } }] });
        const fixture = TestBed.createComponent(DashboardComponent);
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('Votre progression commence ici.');
        expect(fixture.nativeElement.querySelector('[aria-label="Indicateurs"]')).toBeNull();
        expect(fixture.nativeElement.querySelector('a[href="/board"]')).toBeTruthy();
    });
});
