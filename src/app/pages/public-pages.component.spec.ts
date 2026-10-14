import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { PublicPagesComponent } from './public-pages.component';
import { PublicContactComponent, contactMailto, APPROVED_PUBLIC_CONTACT } from './public-contact.component';
import { PublicHeaderComponent, PublicFooterComponent } from '../shared/public-navigation.component';
import { PlatformSettingsService, PlatformSettings } from '../services/platform-settings.service';
import { routes } from '../app.routes';
import { ThemeService } from '../services/theme.service';

describe('Pages visiteurs Ma’at', () => {
  beforeEach(() => TestBed.resetTestingModule());
  for (const page of ['home', 'features', 'about']) {
    it(`affiche ${page} avec un titre, un contenu principal et des liens fonctionnels`, async () => {
      await TestBed.configureTestingModule({imports:[PublicPagesComponent],providers:[provideRouter(routes),{provide:ActivatedRoute,useValue:{snapshot:{data:{publicPage:page}}}}]}).compileComponents();
      const fixture=TestBed.createComponent(PublicPagesComponent);fixture.detectChanges();
      const el=fixture.nativeElement as HTMLElement;
      expect(el.querySelectorAll('h1').length).toBe(1);
      expect(el.querySelector('main')?.id).toBe('main-content');
      const links=[...el.querySelectorAll('a')];
      expect(links.length).toBeGreaterThan(1);
      for(const link of links){const path=link.getAttribute('href')?.slice(1);expect(routes.some(route=>route.path===path)).toBe(true);}
      if(page==='home')expect(el.textContent).toContain('Exemple illustratif');
    });
  }
  it('propose toutes les destinations publiques', async () => {
    await TestBed.configureTestingModule({imports:[PublicHeaderComponent],providers:[provideRouter(routes)]}).compileComponents();
    const fixture=TestBed.createComponent(PublicHeaderComponent);fixture.detectChanges();
    const links=[...fixture.nativeElement.querySelectorAll('nav a')] as HTMLAnchorElement[];
    expect(links.map(link=>link.getAttribute('href'))).toEqual(['/home','/presentation','/about','/contact']);
  });
  it('affiche la signature, le copyright et les liens légaux', async () => {
    await TestBed.configureTestingModule({imports:[PublicFooterComponent],providers:[provideRouter(routes)]}).compileComponents();
    const fixture=TestBed.createComponent(PublicFooterComponent);fixture.detectChanges();
    const el=fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain("Ma'at by El_Quatro Technology");
    expect(el.textContent).toContain(`© ${new Date().getFullYear()} El_Quatro Technology`);
    expect(el.querySelector('a[href="/privacy"]')).toBeTruthy();expect(el.querySelector('a[href="/terms"]')).toBeTruthy();
  });
  it('bascule le thème avec un bouton explicite et garde le CTA de connexion', async () => {
    const darkMode=signal(false);
    const theme={darkMode,toggleDarkMode:()=>darkMode.update(value=>!value)};
    await TestBed.configureTestingModule({imports:[PublicHeaderComponent],providers:[provideRouter(routes),{provide:ThemeService,useValue:theme}]}).compileComponents();
    const fixture=TestBed.createComponent(PublicHeaderComponent);fixture.detectChanges();
    const el=fixture.nativeElement as HTMLElement;
    const button=el.querySelector('button')!;
    expect(button.getAttribute('aria-label')).toBe('Activer le thème sombre');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.textContent?.trim()).toBe('');
    expect(button.querySelector('svg')).toBeTruthy();
    expect(button.getAttribute('title')).toBe('Activer le thème sombre');
    button.click();fixture.detectChanges();
    expect(darkMode()).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('Activer le thème clair');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('header')?.classList.contains('visitor-header')).toBe(true);
    expect(el.querySelector('a[href="/login"]')?.classList.contains('visitor-login')).toBe(true);
    button.click();fixture.detectChanges();expect(darkMode()).toBe(false);
  });
  it('refuse les adresses et en-têtes injectés dans mailto', () => {
    for(const email of ['', 'javascript:alert(1)', 'x@example.com?bcc=other@example.com', 'x@example.com\r\nBcc:other@example.com'])expect(contactMailto(email)).toBeNull();
    expect(contactMailto(APPROVED_PUBLIC_CONTACT)).toContain('mailto:pontienmisenga93%40gmail.com?subject=');
  });
  it('ouvre le hamburger, annonce son état et se ferme avec Échap', async () => {
    await TestBed.configureTestingModule({imports:[PublicHeaderComponent],providers:[provideRouter([])]}).compileComponents();
    const fixture=TestBed.createComponent(PublicHeaderComponent);fixture.detectChanges();
    const el=fixture.nativeElement as HTMLElement;
    const toggle=el.querySelector<HTMLButtonElement>('.visitor-menu-toggle')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe(el.querySelector('nav')?.id);
    toggle.click();fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('nav')?.classList.contains('visitor-menu-open')).toBe(true);
    const focus=vi.spyOn(toggle,'focus').mockImplementation(()=>undefined);
    toggle.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(focus).toHaveBeenCalledOnce();
  });
  it('ferme le menu mobile lors d’un clic extérieur', async () => {
    await TestBed.configureTestingModule({imports:[PublicHeaderComponent],providers:[provideRouter([])]}).compileComponents();
    const fixture=TestBed.createComponent(PublicHeaderComponent);fixture.detectChanges();
    fixture.nativeElement.querySelector('.visitor-menu-toggle').click();fixture.detectChanges();
    expect(fixture.componentInstance.mobileOpen()).toBe(true);
    document.body.dispatchEvent(new MouseEvent('click',{bubbles:true}));fixture.detectChanges();
    expect(fixture.componentInstance.mobileOpen()).toBe(false);
  });
  it('utilise le contact autorisé, puis le contact public configuré, sans formulaire factice', async () => {
    const settings=signal<PlatformSettings|null>(null);
    await TestBed.configureTestingModule({imports:[PublicContactComponent],providers:[provideRouter(routes),{provide:PlatformSettingsService,useValue:{settings}}]}).compileComponents();
    const fixture=TestBed.createComponent(PublicContactComponent);fixture.detectChanges();
    expect(fixture.componentInstance.email()).toBe(APPROVED_PUBLIC_CONTACT);
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    settings.set({support_email:'support@example.com',announcement:'',version:1,updated_at:''});fixture.detectChanges();
    expect(fixture.componentInstance.email()).toBe('support@example.com');
    expect(fixture.nativeElement.querySelector('a[href^="mailto:"]')?.getAttribute('href')).toContain('support%40example.com');
    settings.set({support_email:'bad\n@example.com',announcement:'',version:2,updated_at:''});fixture.detectChanges();
    expect(fixture.componentInstance.email()).toBe(APPROVED_PUBLIC_CONTACT);
  });
});
