import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi, type Mock, type Mocked } from "vitest";
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { CloudStorageProvider } from './providers/cloud-storage.provider';
describe('AppComponent', () => {
    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AppComponent],
            providers: [provideRouter([]), { provide: CloudStorageProvider, useValue: {
                auth: {
                    initializing: signal(false), user: signal(null), sessionError: signal(''),
                    displayName: () => 'Compte test', avatarUrl: () => null, adminAccess: () => false,
                },
                status: signal('Mode local'), conflict: signal(false),
                localBackupStatus: signal('Copie confirmée'), exportDownload: signal(null),
            } }],
        }).compileComponents();
    });
    it('should create the app', () => {
        const fixture = TestBed.createComponent(AppComponent);
        const app = fixture.componentInstance;
        expect(app).toBeTruthy();
    });
    it(`should have the application title`, () => {
        const fixture = TestBed.createComponent(AppComponent);
        const app = fixture.componentInstance;
        expect(app.title).toEqual('Ma’at');
    });
    it('should render the router outlet', () => {
        const fixture = TestBed.createComponent(AppComponent);
        fixture.detectChanges();
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('router-outlet')).toBeTruthy();
    });
    it('moves keyboard focus to the skip-link destination without adding it to Tab order', () => {
        const fixture=TestBed.createComponent(AppComponent);
        fixture.componentInstance.loading.set(false);
        const main=document.createElement('main');main.id='main-content';document.body.append(main);
        const scroll=vi.spyOn(main,'scrollIntoView').mockImplementation(()=>undefined);
        try {
            const event=new MouseEvent('click',{cancelable:true});
            fixture.componentInstance.skipToContent(event);
            expect(event.defaultPrevented).toBe(true);
            expect(document.activeElement).toBe(main);
            expect(main.tabIndex).toBe(-1);
            expect(scroll).toHaveBeenCalledOnce();
        } finally {main.remove();}
    });
    it('does not intercept the skip link when no route content is ready', () => {
        const fixture=TestBed.createComponent(AppComponent);
        fixture.componentInstance.loading.set(true);
        const event=new MouseEvent('click',{cancelable:true});
        fixture.componentInstance.skipToContent(event);
        expect(event.defaultPrevented).toBe(false);
    });
    for (const path of ['/home', '/presentation', '/about', '/contact', '/privacy', '/terms']) {
        it(`sépare la page visiteur ${path} du compte et du menu de travail`, () => {
            vi.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue(path + '?source=test');
            const fixture = TestBed.createComponent(AppComponent);
            fixture.detectChanges();
            const el = fixture.nativeElement as HTMLElement;
            expect(fixture.componentInstance.publicLayout()).toBe(true);
            expect(fixture.componentInstance.workspaceLayout()).toBe(false);
            expect(el.querySelector('app-public-header')).toBeTruthy();
            expect(el.querySelector('app-public-footer')).toBeTruthy();
            expect(el.querySelector('app-account-bar')).toBeNull();
            expect(el.querySelector('app-workspace-nav')).toBeNull();
        });
    }
});
