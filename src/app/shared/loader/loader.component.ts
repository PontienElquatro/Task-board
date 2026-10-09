import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Animation supplied by the user; demonstration scripts intentionally omitted. */
@Component({selector:'app-maat-loader',standalone:true,changeDetection:ChangeDetectionStrategy.OnPush,template:`
<div class="maat-loading-screen" role="status" aria-live="polite" aria-atomic="true">
  <div class="maat-loader">
    <div class="maat-loader__icon" aria-hidden="true">
      <svg class="maat-loader__feather" viewBox="0 0 30 40"><path d="M15 2 C22 12 23 24 15 32 C7 24 8 12 15 2 Z" /></svg>
      <div class="maat-loader__columns"><span class="maat-loader__col"></span><span class="maat-loader__col"></span><span class="maat-loader__col"></span></div>
    </div>
    <p class="maat-loader__text">{{label}}<span class="maat-loader__dots" aria-hidden="true"><span></span><span></span><span></span></span></p>
  </div>
</div>`})
export class LoaderComponent { @Input() label='Chargement de Ma’at'; }
