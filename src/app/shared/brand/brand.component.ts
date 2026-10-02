import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Drawings supplied in deepseek_html_20261001_b20f90.html; no new font loaded. */
@Component({
  selector: 'app-brand',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex items-center gap-2" aria-label="Ma’at">
      <img [src]="compact ? 'brand/maat-icon-dark.svg' : 'brand/maat-lockup.svg'"
        [class]="compact ? 'block size-9 dark:hidden' : 'block h-16 w-40 max-w-full dark:hidden'"
        alt="Ma’at" [attr.width]="compact ? 36 : 160" [attr.height]="compact ? 36 : 64">
      <img [src]="compact ? 'brand/maat-icon-dark.svg' : 'brand/maat-lockup-dark.svg'"
        [class]="compact ? 'hidden size-9 dark:block' : 'hidden h-16 w-40 max-w-full dark:block'"
        alt="Ma’at" [attr.width]="compact ? 36 : 160" [attr.height]="compact ? 36 : 64">
    </span>
  `
})
export class BrandComponent {
  @Input() compact = false;
}
