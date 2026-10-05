import { Component, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SwUpdate } from '@angular/service-worker';
import { AccountBarComponent } from './account-bar/account-bar.component';
import { Router, RouterOutlet, NavigationStart, NavigationEnd, NavigationCancel, NavigationError, NavigationSkipped } from '@angular/router';
import { LoaderComponent } from './shared/loader/loader.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { inject } from '@angular/core';
import { ThemeService } from './services/theme.service';
import { ToastComponent } from './shared/toast.component';
import { BRAND } from './core/brand';
import { WorkspaceNavComponent } from './shared/workspace-nav.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ToastComponent, RouterOutlet, CommonModule, AccountBarComponent, LoaderComponent, WorkspaceNavComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnDestroy {
  readonly loading = signal(true);
  private readonly router = inject(Router);
  readonly workspaceLayout = signal(true);
  readonly authLayout = signal(false);
  private updateLayout(url:string) {
    const path=url.split(/[?#]/)[0];
    this.authLayout.set(path==='/login');
    this.workspaceLayout.set(['/board','/dashboard','/projects','/team-projects','/calendar','/team','/settings','/admin'].includes(path));
  }
  private readonly theme = inject(ThemeService);
  private readonly updates = inject(SwUpdate, { optional: true });
  readonly updateReady = signal(false);
  private readonly subscription = this.updates?.versionUpdates.subscribe(event => {
    if (event.type === 'VERSION_READY') this.updateReady.set(true);
  });
  constructor() {
    this.updateLayout(this.router.url);
    this.loading.set(!this.router.navigated);
    this.router.events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event instanceof NavigationStart) this.loading.set(true);
      if (event instanceof NavigationEnd) this.updateLayout(event.urlAfterRedirects);
      if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError || event instanceof NavigationSkipped) this.loading.set(false);
    });
    if (this.updates?.isEnabled) this.updates.checkForUpdate().catch(() => { /* Offline: retain current app and local tasks. */ });
  }
  reload() { window.location.reload(); }
  ngOnDestroy() { this.subscription?.unsubscribe(); }
  title = BRAND.name;
}
