import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi, type Mock, type Mocked } from "vitest";
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WorkspaceNavComponent } from './workspace-nav.component';
describe('Navigation commune Ma’at', () => {
    beforeEach(() => TestBed.configureTestingModule({ imports: [WorkspaceNavComponent], providers: [provideRouter([])] }));
    it('propose les mêmes destinations dans tout l’espace de travail', () => {
        const fixture = TestBed.createComponent(WorkspaceNavComponent);
        fixture.detectChanges();
        const nav = fixture.nativeElement as HTMLElement;
        const destinations = ['/team-projects', '/board', '/projects', '/calendar', '/dashboard', '/team', '/settings', '/help'];
        for (const path of destinations)
            expect(nav.querySelector('a[href="' + path + '"]')).toBeTruthy();
        expect(nav.querySelector('nav')?.getAttribute('aria-label')).toBe('Navigation principale');
        const menu = nav.querySelector('details') as HTMLDetailsElement;
        expect(menu.open).toBe(false);
        expect(menu.querySelector('summary')?.textContent).toContain('Navigation');
        const mobileLinks = Array.from(menu.querySelectorAll('a'), link => link.getAttribute('href'));
        expect(mobileLinks.length).toBe(destinations.length);
        expect(mobileLinks).toEqual(destinations);
    });
});
