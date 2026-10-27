import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi, type Mock, type Mocked } from "vitest";
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { CloudStorageProvider } from '../providers/cloud-storage.provider';
describe('LoginComponent', () => {
    let component: LoginComponent;
    let fixture: ComponentFixture<LoginComponent>;
    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [LoginComponent],
            providers: [provideRouter([]),
                { provide: AuthService, useValue: { initializing: signal(false), user: signal(null), sessionError:signal('') } },
                { provide: CloudStorageProvider, useValue: { status: signal('Mode local'), ready: signal(true), conflict: signal(false) } }]
        })
            .compileComponents();
        fixture = TestBed.createComponent(LoginComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });
    it('should create', () => {
        expect(component).toBeTruthy();
    });
    it('réinitialise la validation au changement de mode sans perdre l’email', async () => {
        await fixture.whenStable();
        const email = fixture.nativeElement.querySelector('#account-email') as HTMLInputElement;
        email.value = 'adresse-invalide';
        email.dispatchEvent(new Event('input'));
        email.dispatchEvent(new Event('blur'));
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(email.getAttribute('aria-invalid')).toBe('true');
        component.setMode('signup');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(component.email).toBe('adresse-invalide');
        expect(email.getAttribute('aria-invalid')).toBeNull();
        expect(component.accountForm?.touched).toBe(false);
    });
    it('affiche des champs nommés et le lien de récupération', () => {
        const element = fixture.nativeElement as HTMLElement;
        expect(element.querySelector('label[for="account-email"]')).toBeTruthy();
        expect(element.querySelector('input[autocomplete="current-password"]')).toBeTruthy();
        expect(element.textContent).toContain('Mot de passe oublié ?');
    });
    it('structure l’inscription avec une confirmation du mot de passe', () => {
        component.setMode('signup');
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('#account-confirm')).toBeTruthy();
        expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Créer un compte');
    });
    it('ne demande que l’email pour récupérer son accès', () => {
        component.setMode('reset');
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('#account-email')).toBeTruthy();
        expect(fixture.nativeElement.querySelector('#account-password')).toBeNull();
        expect(fixture.nativeElement.textContent).toContain('Retour à la connexion');
    });
    it('ne redemande pas l’email pendant le changement de mot de passe', () => {
        component.setMode('recovery');
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('#account-email')).toBeNull();
        expect(fixture.nativeElement.querySelector('#account-confirm')).toBeTruthy();
    });
    it('propose un nouveau lien quand la session de récupération est absente', () => {
        component.setMode('recovery');
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('Demander un nouveau lien');
        expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
    });
    it('ne tente pas de changer le mot de passe sans session', async () => {
        component.setMode('recovery');
        component.password=component.confirmation='a-new-password-123';
        await component.submit();
        expect(component.error()).toContain('Demandez un nouveau lien');
        expect(component.busy()).toBe(false);
    });
});
