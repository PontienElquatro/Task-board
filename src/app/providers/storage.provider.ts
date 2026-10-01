import { InjectionToken } from '@angular/core';

export interface StorageProvider {
  contextVersion?: import('@angular/core').Signal<number>;
  getItem<T>(key: string): T | null;
  setItem<T>(key: string, value: T): void;
  removeItem(key: string): void;
}

export const STORAGE_PROVIDER = new InjectionToken<StorageProvider>('StorageProvider');
