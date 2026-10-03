# Reprise globale de l’interface

## Principes

- Une seule navigation dans les espaces Tableau, Projets, Calendrier, Vue d’ensemble, Équipe, Paramètres et Administration.
- Navigation horizontale défilante sur mobile ; état de page actif et intitulés explicites.
- Pages publiques hors de l’espace de travail ; authentification sans barre de compte globale.
- Palette bleu/gris, logos fournis et police système conservés.
- Densité, panneaux et hiérarchie harmonisés ; actions des cartes regroupées dans un menu natif accessible.
- Services métier, authentification et synchronisation inchangés.

## Contrôles avant publication

Compiler, puis tester le rendu à 390, 768 et 1440 pixels, en clair et sombre. Vérifier les menus de cartes en bas des colonnes et aux bords de l’écran, les filtres projet, les archives et le passage entre toutes les destinations. Vérifier les écrans login, inscription et récupération.

Les tests unitaires ajoutés couvrent les destinations de navigation et la structure du menu de carte. Ils ne remplacent pas des captures navigateur et une revue visuelle. Aucun nouveau score de qualité n’est attribué avant cette revue.

## Limites fonctionnelles inchangées

Invitations non activées, édition de profil à terminer et textes juridiques provisoires. Aucun faux envoi ou accès partagé n’est ajouté par cette refonte.
