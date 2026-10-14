import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi, type Mock, type Mocked } from "vitest";
import { TestBed, DeferBlockBehavior, DeferBlockState } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AccountBarComponent } from './account-bar.component';
import { CloudStorageProvider } from '../providers/cloud-storage.provider';
import { PlatformSettingsService } from '../services/platform-settings.service';
import { ThemeService } from '../services/theme.service';
import { NotificationsComponent } from '../shared/notifications.component';
@Component({ selector: 'app-notifications', standalone: true, template: '' })
class TestNotificationsComponent {
}
describe('AccountBarComponent account controls', () => {
    async function setup() {
        const cloud = {
            auth: { initializing: signal(true), user: signal<unknown>(null),
                displayName: () => 'Compte test', avatarUrl: () => null, adminAccess: () => false, sessionError: signal(''), signOut: vi.fn().mockName('signOut').mockResolvedValue(undefined) },
            conflict: signal(false), conflictItems: signal([]), ready: signal(true), status: signal('Synchronisé avec votre compte'),
            exportDownload: signal<{
                url: string;
                filename: string;
            } | null>(null), exportDeviceCopies: vi.fn().mockName('exportDeviceCopies'),
            localBackupStatus: signal('Copie locale'), sync: vi.fn().mockName('sync').mockResolvedValue(undefined)
        };
        TestBed.configureTestingModule({ imports: [AccountBarComponent], deferBlockBehavior: DeferBlockBehavior.Manual,
            providers: [provideRouter([]), { provide: CloudStorageProvider, useValue: cloud },
                { provide: PlatformSettingsService, useValue: { settings: signal(null) } },
                { provide: ThemeService, useValue: { darkMode: signal(false), toggleDarkMode: () => { } } }] });
        TestBed.overrideComponent(AccountBarComponent, { remove: { imports: [NotificationsComponent] }, add: { imports: [TestNotificationsComponent] } });
        await TestBed.compileComponents();
        const fixture = TestBed.createComponent(AccountBarComponent);
        fixture.detectChanges();
        return { cloud, fixture, component: fixture.componentInstance };
    }
    it('keeps session initialization visible rather than hiding the account bar', async () => {
        const { fixture } = await setup();
        expect(fixture.nativeElement.textContent).toContain('Vérification de la sauvegarde');
    });
    it('shows identity and logout for a connected account', async () => {
        const { cloud, fixture } = await setup();
        cloud.auth.initializing.set(false);
        cloud.auth.user.set({ id: 'test' });
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('Compte test');
        expect(fixture.nativeElement.textContent).toContain('Déconnexion');
    });
    it('syncs before signing out', async () => {
        const { cloud, component } = await setup();
        await component.signOut();
        expect(cloud.sync).toHaveBeenCalled();
        expect(cloud.auth.signOut).toHaveBeenCalled();
        expect(component.signingOut()).toBe(false);
    });
    it('keeps recovery actions behind the account menu', async () => {
        const { fixture } = await setup();
        const menu = fixture.nativeElement.querySelector('details');
        expect(menu.open).toBe(false);
        expect(fixture.nativeElement.querySelector('.account-bar')).toBeNull();
    });
    it('closes the account menu with Escape', async () => {
        const { fixture } = await setup();
        const menu = fixture.nativeElement.querySelector('details');
        menu.open = true;
        menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(menu.open).toBe(false);
    });
    it('does not silently sign out with unconfirmed cloud writes', async () => {
        const { cloud, component } = await setup();
        cloud.status.set('Cloud indisponible · réessayer');
        await component.signOut();
        expect(cloud.auth.signOut).not.toHaveBeenCalled();
        expect(component.logoutError()).toContain('sauvegarde cloud');
    });
    it('keeps a direct download link after preparing an export', async () => {
        const { cloud, fixture } = await setup();
        cloud.exportDownload.set({ url: 'blob:unit-export', filename: 'maat.json' });
        fixture.detectChanges();
        const link = fixture.nativeElement.querySelector('a[download="maat.json"]');
        expect(link.textContent).toContain('Télécharger');
        expect(link.getAttribute('href')).toBe('blob:unit-export');
    });
    it('offers export rather than an ineffective retry for an unresolved conflict', async () => {
        const { cloud, fixture } = await setup();
        cloud.conflict.set(true);
        fixture.detectChanges();
        const alert = fixture.nativeElement.querySelector('[role="alert"]');
        expect(alert.textContent).toContain('Exporter toutes les copies');
        expect(alert.textContent).not.toContain('Réessayer');
    });
    it('does not create deferred recovery or conflict views at startup', async () => {
        const { fixture } = await setup();
        expect(await fixture.getDeferBlocks()).toHaveLength(0);
        expect(fixture.nativeElement.querySelector('app-device-restore')).toBeNull();
        expect(fixture.nativeElement.querySelector('app-sync-conflict')).toBeNull();
    });
    it('keeps export available when the deferred conflict window fails to load', async () => {
        const { cloud, fixture } = await setup();
        cloud.conflict.set(true);
        fixture.detectChanges();
        const [block] = await fixture.getDeferBlocks();
        await block.render(DeferBlockState.Loading);
        expect(fixture.nativeElement.textContent).toContain('Chargement de la résolution');
        await block.render(DeferBlockState.Error);
        const alert = fixture.nativeElement.querySelector('[role="alert"]');
        expect(alert.textContent).toContain('Vos versions restent protégées');
        alert.querySelector('button').click();
        expect(cloud.exportDeviceCopies).toHaveBeenCalled();
        expect(cloud.conflict()).toBe(true);
    });
    it('allows closing a failed deferred recovery view without changing data', async () => {
        const { cloud, component, fixture } = await setup();
        component.restoreOpen = true;
        fixture.detectChanges();
        const [block] = await fixture.getDeferBlocks();
        await block.render(DeferBlockState.Loading);
        expect(fixture.nativeElement.textContent).toContain('Chargement de la récupération');
        await block.render(DeferBlockState.Error);
        const alert = fixture.nativeElement.querySelector('[role="alert"]');
        expect(alert.textContent).toContain('Aucune donnée n’a été modifiée');
        alert.querySelector('button').click();
        fixture.detectChanges();
        expect(component.restoreOpen).toBe(false);
        expect(await fixture.getDeferBlocks()).toHaveLength(0);
        expect(cloud.sync).not.toHaveBeenCalled();
    });
});
