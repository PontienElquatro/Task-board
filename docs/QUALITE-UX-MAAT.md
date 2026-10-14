# Refonte de l’expérience Ma’at

Objectifs demandés : frontend 95 %, cohérence 90 %, UX 90 %, ensemble 95 %.
Ces objectifs ne sont pas des scores mesurés : ils ne peuvent être certifiés par
une compilation ou une appréciation visuelle seule.

## Changements livrés

- Une navigation principale, sans double rail visible.
- Identité, statut compact de sauvegarde et déconnexion dans l’en-tête commun.
- Sauvegardes de secours et récupération derrière un menu explicite.
- Statistiques repliables pour laisser la priorité aux tâches.
- Recherche pleine largeur sur mobile, filtres avancés avec compteur et fermeture.
- Outils d’import/export regroupés ; projet sélectionnable et créable sur mobile.
- Cartes sans identifiants techniques et sans métadonnées inutiles.
- État explicite quand une recherche ne donne aucun résultat.
- Clavier : lien d’évitement, Escape pour les menus, focus visible.
- Palette, police et dessins de marque conservés. Pas de changement de schéma BDD.

## Vérification reproductible

1. `npm run build` (génère la configuration isolée avant Angular).
2. `npm run preview` pour servir le build local.
3. Avec Playwright disponible : `npm run test:ux`.
   `MAAT_PLAYWRIGHT_PATH` permet d’utiliser une installation existante de Playwright.
   `CHROME_BIN` permet de choisir Chrome installé.
4. Le test contrôle 1440, 768 et 390 px, en clair et sombre : création locale,
   rechargement, recherche, filtres, débordement de page, taille de l’action principale.
   Il bloque toutes les requêtes hors localhost. Les captures PNG sont dans outputs/ux.
5. `npm run test:ci`, puis `npm run test:cloud-browser` sur un build local pour les
   scénarios de synchronisation simulée. Les tests ne prouvent pas à eux seuls
   le bon fonctionnement du backend réel.

## Critères avant d’annoncer une expérience aboutie

- Examiner les six captures et tester un écran étroit de 320 px et le zoom à 200 %.
- Retester le cloud réel sur Maat-test avec un compte autorisé : sauvegarde,
   reconnexion, modification, sous-tâches, archives/restauration, erreur réseau.
- Contrôler le drag & drop au pointeur et les changements de statut au clavier.
- Auditer le contraste (4,5:1 pour texte normal), l’ordre de focus et les lecteurs d’écran.
- Tester les menus et la modale au clavier, avec tactile et mouvements réduits.
- Faire réaliser créer/retrouver/modifier/archiver une tâche à des utilisateurs,
   noter réussite, erreurs et temps ; corriger puis retester.
- Vérifier séparément administration et authentification sur mobile.

Validation locale de cette itération : compilation des templates Angular et TypeScript
réussie. Build complet bloqué par les restrictions de lecture du sandbox Windows ;
captures et tests navigateur non exécutés sur ce nouveau build. Ne pas confondre
les vérifications préparées avec les vérifications réalisées.
