# Cartes communes et menus mobiles

Le même TaskCard est utilisé par le tableau personnel et les projets partagés : titre compact, métadonnées lisibles, progression simplifiée sans encart imbriqué, avatar existant et actions tactiles de 44 px. Les palettes, états, événements, filtres et permissions ne changent pas.

Notifications et compte : panneaux fixes avec marges de 16 px sur mobile/tablette, puis panneaux ancrés à partir de 1024 px. En-tête compact sur téléphone, avec noms accessibles conservés pour les boutons dont seul l'avatar ou l'icône est visible. Avatar commun avec repli sur initiales si la photo échoue.

DismissMenuDirective ferme les menus au clic extérieur et avec Échap (focus remis au summary). Appliquée au compte, aux notifications, aux cartes, aux filtres et à la navigation mobile. Les boutons Fermer des panneaux compte/notifications restent disponibles.

Vérifications :
- Compilation Angular et TypeScript des specs réussie.
- 31 tests Node de non-régression réussis.
- Specs de cartes corrigées pour les actions actuelles ; specs de fermeture ajoutées.
- Le lancement Karma/Chrome est resté sans résultat dans cet environnement et a été interrompu : ces specs ne sont pas déclarées exécutées.

Après déploiement : vérifier à 320, 390, 768 et 1440 px, en clair et sombre :
1. Les notifications et le compte restent entièrement dans l'écran.
2. Le contenu du panneau défile ; les boutons de fermeture sont accessibles.
3. Ouvrir le compte ferme les notifications ; clic extérieur et Échap ferment le menu.
4. Échap remet le focus sur son déclencheur.
5. Cartes personnelles et partagées : mêmes proportions, actions accessibles au toucher et au clavier.
6. Aucune barre de progression sans sous-tâches ; workflow précédent conservé.

Aucune migration de base requise pour cette étape. Validation visuelle du nouveau code après build/push encore nécessaire.
