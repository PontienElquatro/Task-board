import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { StorageProvider } from './storage.provider';
@Injectable({ providedIn: 'root' })
export class LocalStorageProvider implements StorageProvider {
  private readonly platformId = inject(PLATFORM_ID);
  getItem<T>(key: string): T | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const value = localStorage.getItem(key);
    return value === null ? null : JSON.parse(value) as T;
  }
  setItem<T>(key: string, value: T): void {
    if (isPlatformBrowser(this.platformId)) localStorage.setItem(key, JSON.stringify(value));
  }
  removeItem(key: string): void {
    if (isPlatformBrowser(this.platformId)) localStorage.removeItem(key);
  }
}
