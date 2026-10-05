import { Injectable, PLATFORM_ID, inject, signal, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

type Palette = 'neutral' | 'classic' | 'soft';
type Style = 'accent' | 'tinted';

// Complete, static Tailwind classes so production CSS includes every palette.
const colors = {
  classic: {
    todo: ['border-l-blue-500', 'bg-blue-50 dark:bg-blue-950'],
    'in-progress': ['border-l-orange-500', 'bg-orange-50 dark:bg-orange-950'],
    done: ['border-l-green-500', 'bg-green-50 dark:bg-green-950']
  },
  soft: {
    todo: ['border-l-violet-500', 'bg-violet-50 dark:bg-violet-950'],
    'in-progress': ['border-l-rose-500', 'bg-rose-50 dark:bg-rose-950'],
    done: ['border-l-teal-500', 'bg-teal-50 dark:bg-teal-950']
  }
};

@Injectable({ providedIn: 'root' })
export class CardAppearanceService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly palette = signal<Palette>('neutral');
  readonly style = signal<Style>('accent');
  readonly palettes = [
    { id: 'neutral', label: 'Ma’at · neutre' },
    { id: 'classic', label: 'Bleu · orange · vert' },
    { id: 'soft', label: 'Violet · rose · turquoise' }
  ];
  constructor() {
    if (this.browser) {
      try {
        const saved = JSON.parse(localStorage.getItem('maat_card_appearance') || '{}');
        this.setPalette(saved.palette);
        this.setStyle(saved.style);
      } catch { /* Keep safe defaults if storage is unavailable or invalid. */ }
    }
    effect(() => {
      const preference = { palette: this.palette(), style: this.style() };
      if (this.browser) {
        try { localStorage.setItem('maat_card_appearance', JSON.stringify(preference)); } catch { /* In-memory preference still works. */ }
      }
    });
  }
  setPalette(value: string) {
    if (value === 'neutral' || value === 'classic' || value === 'soft') this.palette.set(value);
  }
  setStyle(value: string) {
    if (value === 'accent' || value === 'tinted') this.style.set(value);
  }
  classes(status: string): string {
    const palette = this.palette();
    if (palette === 'neutral' || !['todo', 'in-progress', 'done'].includes(status)) return 'bg-white dark:bg-gray-800';
    const [border, background] = colors[palette][status as 'todo' | 'in-progress' | 'done'];
    return 'border-l-4 ' + border + ' ' + (this.style() === 'tinted' ? background : 'bg-white dark:bg-gray-800');
  }
}
