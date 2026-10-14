# Préférences de notifications

Paramètres → Notifications, pour les comptes standard et le profil administrateur.

- Assignations reçues : tâches et sous-tâches.
- Travail terminé : tâches et sous-tâches dont le compte est destinataire.
- Sans préférence enregistrée, les deux catégories restent activées.
- Sauvegarde explicite par compte, avec annulation des changements non enregistrés.
- Les choix s’appliquent aux futures notifications de la cloche, pas aux emails,
  aux données du tableau ou à l’historique des notifications.

## Base de données

`database/notification-preferences.sql` est une opération unique, transactionnelle.
Elle ajoute une table avec RLS (compte actif, propriétaire uniquement), puis ajoute
un contrôle dans les deux triggers existants. Les fonctions restent non appelables
par les clients. Les gardes vérifient la forme attendue des fonctions avant édition.
Ne pas relancer le script après application. Migration distante appliquée à
Maat-test sous le nom `notification_preferences`; production non modifiée.

`database/test-notification-preferences.sql` teste la livraison désactivée/activée,
la progression du travail et l’isolation des lectures/écritures entre deux comptes.
Tous les changements de test sont annulés. Il nécessite une équipe active avec
deux membres. Les scripts historiques de notifications restent applicables.

## Validation UI après déploiement

1. Ouvrir Notifications dans les paramètres d’un compte connecté.
2. Désactiver une catégorie, enregistrer, quitter/revenir : valeur conservée.
3. Effectuer l’action correspondante avec un autre membre : pas de nouvelle alerte.
4. Réactiver et répéter : nouvelle alerte reçue.
5. Vérifier que les anciennes alertes restent visibles et que les deux comptes
   conservent des préférences distinctes.
6. Vérifier mobile, thème sombre, clavier et erreurs réseau.

Les tests unitaires couvrent le chargement, l’enregistrement, l’annulation, les
erreurs et les réponses tardives d’un autre compte. Le statut final de compilation
et des tests doit être confirmé avant publication.
