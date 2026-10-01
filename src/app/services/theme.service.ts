import { Injectable, signal, effect, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  readonly darkMode = signal(this.loadTheme());
  constructor() {
    effect(() => {
      const dark = this.darkMode();
      if (!isPlatformBrowser(this.platformId)) return;
      this.document.documentElement.classList.toggle('dark', dark);
      try { localStorage.setItem('mytaskboard_theme', dark ? 'dark' : 'light'); } catch { /* Theme works without storage. */ }
    });
  }
  private loadTheme() {
    if (!isPlatformBrowser(this.platformId)) return false;
    try { const theme = localStorage.getItem('mytaskboard_theme'); if (theme) return theme === 'dark'; } catch { /* Use system preference. */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  toggleDarkMode() { this.darkMode.update(value => !value); }
}
