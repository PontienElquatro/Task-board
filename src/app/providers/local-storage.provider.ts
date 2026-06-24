import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { StorageProvider } from './storage.provider';

@Injectable({
  providedIn: 'root'
})
export class LocalStorageProvider implements StorageProvider {
  private platformId = inject(PLATFORM_ID);

  getItem<T>(key: string): T | null {
    if (isPlatformBrowser(this.platformId)) {
      const item = localStorage.getItem(key);
      if (item) {
        try {
          return JSON.parse(item);
        } catch (e) {
          console.error(`Error parsing localStorage key "${key}"`, e);
          return null;
        }
      }
    }
    return null;
  }

  setItem<T>(key: string, value: T): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  removeItem(key: string): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(key);
    }
  }
}
