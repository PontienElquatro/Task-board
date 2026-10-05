# Refonte des interfaces — 5 octobre 2026

## Parcours livrés

- Projets d’équipe : première équipe sélectionnée, galerie de projets, ouverture du tableau, retour à la galerie.
- Un composant de carte commun aux espaces personnel et partagé. Les actions non disponibles côté équipe ne sont pas proposées.
- Détails partagés hors des colonnes, dans une fenêtre centrée avec focus piégé, fermeture au clavier et protection des brouillons (ajustement après retour utilisateur).
- Ajout d’une tâche depuis le tableau ou sa colonne. Sous-tâches et assignations restent dans le panneau.
- Le filtre responsable inclut les tâches contenant une sous-tâche assignée à la personne recherchée.
- Fenêtres personnelles centrées, création/renommage de projets, vue d’ensemble et indicateurs administratifs harmonisés.
- Menu du compte compact avec en-tête de profil, icônes SVG bleu/indigo et sauvegardes regroupées. Déconnexion rouge ; commandes de thème, annulation et filtres harmonisées avec le logo.
- Confirmations de profil, photo et équipe dans le popup global de trois secondes. Les erreurs restent persistantes.
- Palette des cartes, typographie, règles de droits et opérations backend existantes conservées.

## Vérifications

`ngc -p tsconfig.app.json --noEmit` et les 13 tests Node (cartes partagées, sessions par onglet, file de rafraîchissement, popup) passent.

La compilation complète échoue dans l’environnement de l’agent avec `Cannot read directory ... : Accès refusé` dans le moteur de résolution. Aucun résultat de navigateur ni capture de cette version n’est donc déclaré validé.

Le scénario `tools/test-interface-browser.mjs` est ajouté, mais **pas encore exécuté**. Il intercepte toutes les requêtes distantes et utilise uniquement des comptes fictifs. Après une compilation locale réussie :

```powershell
npm run build
$env:PORT="4215"
node tools/serve-built.mjs
# Dans un autre terminal avec Playwright disponible :
$env:MAAT_TEST_URL="http://127.0.0.1:4215"
node tools/test-interface-browser.mjs
```

Scénarios prévus : galerie → tableau → détails, conservation d’un brouillon, enregistrement, clôture de tâche, formulaire de création, navigation vers la vue d’ensemble, absence de débordement global ; bureau/mobile et clair/sombre.

## Limites

Cette livraison ne modifie ni les migrations ni les notifications backend. Les notifications de clôture vers l’auteur de l’assignation et les photos de tous les membres via le roster restent un chantier distinct. Le responsable apparaît sur les cartes partagées avec des initiales, pas une photo prétendue disponible.
