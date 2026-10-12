import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({standalone:true,imports:[RouterLink],template:`
<main id="main-content" class="mx-auto max-w-2xl p-6 text-gray-900 dark:text-gray-100">
  <section class="rounded-2xl border border-blue-100 bg-white p-6 dark:border-indigo-900 dark:bg-gray-900">
    <h1 class="text-2xl font-semibold">Accès administrateur indisponible</h1>
    <p class="mt-4 leading-6">Ce compte ne dispose pas des droits administrateur, ou leur vérification est momentanément indisponible. Aucun accès aux données de la plateforme n’a été accordé.</p>
    <div class="mt-6 flex flex-wrap gap-3"><a class="primary min-h-11" routerLink="/board">Revenir à mon espace</a><a class="secondary min-h-11" routerLink="/admin">Réessayer la vérification</a></div>
  </section>
</main>`})
export class AdminAccessDeniedComponent {}
