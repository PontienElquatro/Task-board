import { Injectable, signal, effect, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  darkMode = signal<boolean>(this.loadTheme());

  constructor() {
    effect(() => {
      const isDark = this.darkMode();
      if (isPlatformBrowser(this.platformId)) {
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('mytaskboard_theme', isDark ? 'dark' : 'light');
      }
    });
  }

  private loadTheme(): boolean {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem('mytaskboard_theme');
      if (saved) {
        return saved === 'dark';
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  }

  toggleDarkMode() {
    this.darkMode.update(dark => !dark);
  }
}
