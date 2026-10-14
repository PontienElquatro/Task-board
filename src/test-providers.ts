import { provideZoneChangeDetection } from '@angular/core';

// Match the application's explicit zone-based change detection during the migration.
export default [provideZoneChangeDetection({ eventCoalescing: true })];
