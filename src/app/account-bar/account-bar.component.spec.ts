import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AccountBarComponent } from './account-bar.component';
import { CloudStorageProvider } from '../providers/cloud-storage.provider';

describe('AccountBarComponent account controls', () => {
  function setup() {
    const cloud = {
      auth: { initializing: signal(true), user: signal<unknown>(null),
        displayName: () => 'Compte test', sessionError: signal(''), signOut: jasmine.createSpy('signOut').and.resolveTo() },
      conflict: signal(false), ready: signal(true), status: signal('Synchronisé avec votre compte'),
      localBackupStatus: signal('Copie locale'), sync: jasmine.createSpy('sync').and.resolveTo()
    };
    TestBed.configureTestingModule({imports:[AccountBarComponent],
      providers:[provideRouter([]), {provide:CloudStorageProvider,useValue:cloud}]});
    const fixture=TestBed.createComponent(AccountBarComponent);
    fixture.detectChanges();
    return {cloud, fixture, component:fixture.componentInstance};
  }
  it('keeps session initialization visible rather than hiding the account bar', () => {
    const {fixture}=setup();
    expect(fixture.nativeElement.textContent).toContain('Vérification de votre session');
  });
  it('shows identity and logout for a connected account', () => {
    const {cloud,fixture}=setup();
    cloud.auth.initializing.set(false); cloud.auth.user.set({id:'test'}); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Compte test');
    expect(fixture.nativeElement.textContent).toContain('Déconnexion');
  });
  it('syncs before signing out', async () => {
    const {cloud,component}=setup();
    await component.signOut();
    expect(cloud.sync).toHaveBeenCalled(); expect(cloud.auth.signOut).toHaveBeenCalled();
    expect(component.signingOut()).toBeFalse();
  });
  it('keeps recovery actions behind the account menu', () => {
    const {fixture}=setup();
    const menu=fixture.nativeElement.querySelector('details');
    expect(menu.open).toBeFalse();
    expect(fixture.nativeElement.querySelector('.account-bar')).toBeNull();
  });
  it('closes the account menu with Escape', () => {
    const {fixture}=setup();
    const menu=fixture.nativeElement.querySelector('details'); menu.open=true;
    menu.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    expect(menu.open).toBeFalse();
  });
  it('does not silently sign out with unconfirmed cloud writes', async () => {
    const {cloud,component}=setup(); cloud.status.set('Cloud indisponible · réessayer');
    await component.signOut();
    expect(cloud.auth.signOut).not.toHaveBeenCalled();
    expect(component.logoutError()).toContain('sauvegarde cloud');
  });
});
