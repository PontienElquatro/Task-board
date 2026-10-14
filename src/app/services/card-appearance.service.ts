import { Injectable, PLATFORM_ID, inject, signal, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import {cardPalettes,paletteClasses,Palette} from '../core/card-palettes';
type Style = 'accent' | 'tinted';

@Injectable({ providedIn: 'root' })
export class CardAppearanceService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly palette = signal<Palette>('neutral');
  readonly style = signal<Style>('accent');
  readonly palettes:ReadonlyArray<{id:Palette;label:string;family:string;swatches:readonly string[]}>=cardPalettes;
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
    if (cardPalettes.some(p=>p.id===value)) this.palette.set(value as Palette);
  }
  setStyle(value: string) {
    if (value === 'accent' || value === 'tinted') this.style.set(value);
  }
  classes(status: string): string {
    return paletteClasses(this.palette(),status,this.style());
  }
}
