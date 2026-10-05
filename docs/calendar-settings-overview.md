# Refonte calendrier, paramètres et vue d’ensemble

## Périmètre

Palette bleu/indigo Ma’at, typographie existante et services de sauvegarde conservés. Aucun abonnement, nouvelle dépendance ou changement de schéma.

- Calendrier personnel : mois, semaine lundi–dimanche, agenda, navigation, aujourd’hui, recherche, filtre par projet et option d’inclusion des tâches terminées. Jour sélectionné avec liste complète, trois cartes maximum par case et accès aux autres via le panneau du jour. Les tâches sans échéance sont accessibles pour planification dans le formulaire existant. La grille peut défiler horizontalement sur petit écran ; la vue agenda offre une lecture verticale.
- Paramètres : en-tête avec identité/photo, sections profil, apparence avec aperçu, sécurité et sauvegardes. Prénom/nom existants préservés. Préférences d’apparence toujours locales à l’appareil. Une modification d’email nécessite confirmation. Sans compte, la sauvegarde du profil est désactivée.
- Vue d’ensemble : en-tête de marque, statistiques réelles, prochaines actions (retards puis échéances puis haute priorité), accès direct à leur modification, progression par projet, répartition et objectifs existants. Le total représente les tâches non archivées, y compris les terminées, et non une activité historique.

## Vérification

21 tests Node réussis, dont les dates locales, semaines traversant l’année et mois bissextiles. Compilation Angular sans émission et TypeScript des tests contrôlés séparément. Le build complet échoue encore ici sur « Cannot read directory : Accès refusé » dans esbuild. Aucun test navigateur ni capture de cette version n’est déclaré validé.

À contrôler après build local : vues calendrier/mois/semaine/agenda, changement d’année, recherche et filtres, ouverture/replanification d’une tâche, changement de compte, onglets paramètres, apparence en clair/sombre, largeur 390 px et navigation clavier.

## Hors périmètre

Calendrier d’équipe, horaires de rendez-vous, récurrence, glisser-déposer d’échéances, synchronisation Google/Outlook, historique temporel et préférences de notifications serveur ne sont pas implémentés dans cette livraison.
