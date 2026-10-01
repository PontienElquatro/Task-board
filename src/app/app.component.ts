import { Component, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SwUpdate } from '@angular/service-worker';
import { AccountBarComponent } from './account-bar/account-bar.component';
import { RouterOutlet } from '@angular/router';
import { inject } from '@angular/core';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, AccountBarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnDestroy {
  private readonly theme = inject(ThemeService);
  private readonly updates = inject(SwUpdate, { optional: true });
  readonly updateReady = signal(false);
  private readonly subscription = this.updates?.versionUpdates.subscribe(event => {
    if (event.type === 'VERSION_READY') this.updateReady.set(true);
  });
  constructor() {
    if (this.updates?.isEnabled) this.updates.checkForUpdate().catch(() => { /* Offline: retain current app and local tasks. */ });
  }
  reload() { window.location.reload(); }
  ngOnDestroy() { this.subscription?.unsubscribe(); }
  title = 'MyTaskBoard';
}
