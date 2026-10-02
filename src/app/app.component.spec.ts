import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { CloudStorageProvider } from './providers/cloud-storage.provider';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]),{provide:CloudStorageProvider,useValue:{auth:{initializing:signal(false),user:signal(null)},status:signal('Mode local'),conflict:signal(false),localBackupStatus:signal('Copie confirmée')}}],
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
});
