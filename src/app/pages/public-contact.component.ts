import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlatformSettingsService } from '../services/platform-settings.service';

export const APPROVED_PUBLIC_CONTACT = 'pontienmisenga93@gmail.com';
export function contactMailto(value: string): string | null {
  const email = value.trim();
  return /^[a-zA-Z0-9._+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email)
    ? 'mailto:' + encodeURIComponent(email) + '?subject=' + encodeURIComponent('Contact Ma’at') : null;
}
@Component({standalone:true, imports:[RouterLink], styleUrl:'./public-pages.component.css', template:`
  <main id="main-content" class="public-page public-contact"><section class="public-section">
    <p class="public-eyebrow">PARLONS DE VOTRE EXPÉRIENCE</p><h1>Contactez-nous.</h1>
    <p class="public-intro">Une question, une suggestion ou un problème avec Ma’at ? Écrivez à El_Quatro Technology.</p>
    <article class="public-feature mt-8"><h2>Contact par email</h2><p class="public-contact-email">{{email()}}</p>
      @if (mailto(); as href) {<a class="primary mt-6" [href]="href">Écrire un email</a>}
      <p class="mt-4">Ce bouton ouvre votre application de messagerie ; aucun message n’est envoyé automatiquement. Si vous n’avez pas de messagerie configurée, copiez l’adresse ci-dessus.</p>
      <p class="mt-4">Décrivez la page concernée et les étapes du problème. Ne transmettez jamais votre mot de passe, un code de connexion ou un lien de récupération.</p>
    </article><div class="public-actions"><a class="secondary" routerLink="/help">Consulter l’aide</a><a class="secondary" routerLink="/privacy">Données et confidentialité</a></div>
  </section></main>`})
export class PublicContactComponent {
  private readonly platform = inject(PlatformSettingsService);
  readonly email = computed(() => {
    const configured = this.platform.settings()?.support_email ?? '';
    return contactMailto(configured) ? configured.trim() : APPROVED_PUBLIC_CONTACT;
  });
  readonly mailto = computed(() => contactMailto(this.email()));
}
