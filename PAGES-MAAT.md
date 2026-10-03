# Pages Ma’at

Le tableau reste la route d’entrée. Le menu compte et la navigation donnent accès aux nouvelles pages, sans nouvelle dépendance ni service payant.

| Adresse | État |
| --- | --- |
| /presentation | Présentation et accès au tableau / compte |
| /projects | Création, renommage, archivage, restauration, compteurs et ouverture du tableau filtré |
| /calendar | Vue mensuelle, agenda responsive, modification des tâches via le formulaire existant |
| /settings | Préférence clair/sombre et accès à la gestion du compte ; édition du profil non implémentée |
| /team | Page informative ; aucune invitation ni collaboration simulée |
| /help | Démarrage, sauvegardes, filtres et questions fréquentes |
| /privacy et /terms | Textes provisoires, à compléter et valider avant publication publique |
| Adresse inconnue | Page 404 avec liens de récupération |

## Vérification

Compiler les templates avec `ngc -p tsconfig.app.json --noEmit`, puis lancer `npm run test:ci` et `npm run build` dans un terminal autorisé. Les tests ajoutés couvrent les routes, les mois bissextiles et les dates locales. La compilation ne remplace pas une vérification visuelle.

Vérifier en clair et sombre à 390 et 1440 pixels : navigation de chaque page, création / renommage / archivage d’un projet, ouverture de ses tâches, navigation de mois, modification d’une échéance, sauvegarde après rechargement, et adresse inconnue. Vérifier aussi un changement de compte pendant la consultation du calendrier.

## Restant à développer

- Modification sécurisée du profil et procédures de changement d’email / suppression du compte.
- Espaces partagés, membres, règles d’accès, invitations expirables et révocation côté backend avant activation de l’équipe.
- Identité de l’éditeur, contact, conservation des données et validation des textes juridiques.
- Validation navigateur et tests utilisateurs ; aucun score UX n’est garanti par ces ajouts.
