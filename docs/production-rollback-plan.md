# Retour arrière — préparation, pas procédure de production approuvée

## Portée et état

La répétition Auth/public et les lots workspace, collaboration, invitations,
notifications et administration ont réussi localement. Le cluster PostgreSQL
standard ne reproduit pas tous les services Supabase : Storage, Auth HTTP,
Edge Functions, Vault, Cron et Realtime doivent être vérifiés séparément.

La migration `20261015222551_maat_free_release.sql` est générée et son SQL a réussi
la répétition atomique locale ; elle n'est pas encore appliquée à distance.
L'empreinte, la sauvegarde fraîche et les contrôles sont consignés dans
`docs/production-release-freeze.md`. La fonction admin distante v2 doit être
mise à niveau avec le schéma avant ouverture ; ne pas rétablir aveuglément son
ancien contrôle par allowlist après migration.
Ce document ne donne aucune autorisation de suppression ou de restauration distante.

## Avant toute fenêtre de migration

1. Examiner le rapport de parité et traiter chaque écart : correction, omission
   volontaire documentée, ou blocage. Un succès de tests ne signifie pas parité.
2. Geler le candidat exact, ses empreintes et la version du frontend/Edge Functions.
   Les assemblages intermédiaires avec plusieurs commits ne doivent pas être
   présentés comme une migration atomique finale.
3. Relire la version réelle de production : tables et fonctions attendues,
   historique des migrations, état du déploiement et des comptes.
4. Faire une sauvegarde fraîche si l’état a changé depuis celle du 15 octobre.
   Refaire le contrôle de lecture et la répétition de restauration appropriée.
   Le dump ne contient pas les fichiers Storage, les secrets, les réglages Auth
   ni les versions des fonctions Edge. Les sauvegarder/configurer séparément.
5. Prévoir une fenêtre sans écritures et le moyen d’arrêter les nouveaux clients.
   Aucun ajout de forfait ou de ressource externe sans accord explicite.
6. Vérifier la compatibilité de l’ancien frontend avec les nouveaux droits/RPC.
   Si elle n’est pas prouvée, un simple rollback frontend n’est pas une solution.

## Si l’application SQL échoue avant COMMIT

La version finale devra utiliser une transaction, des durées de verrouillage
bornées et arrêt sur erreur. Laisser PostgreSQL annuler cette transaction,
puis vérifier l’absence de changement avant toute nouvelle tentative.
Ne pas continuer après une erreur ni relancer aveuglément une chaîne de scripts.
Cela ne revient pas sur une action externe (email, Auth HTTP, Storage, déploiement) :
aucune de ces actions ne doit être intégrée à cette transaction.

## Si les contrôles échouent après COMMIT

- Arrêter l’ouverture et les écritures ; garder emails et purge désactivés.
- Conserver les diagnostics sans exposer les tâches, comptes ou secrets.
- Privilégier un correctif ciblé et répété si les nouvelles données sont valides.
- Ne pas supprimer les nouvelles tables ni rétablir une ancienne sauvegarde
  après des inscriptions/écritures sans mesurer explicitement la perte de données.
- Une restauration reste une opération distincte, à répéter sur une cible
  adaptée à Supabase et à autoriser explicitement avant intervention distante.
  Ne jamais lancer pg_restore --clean sur la production pour « tester ».
- Rétablir les versions de frontend/Edge Functions seulement avec une base
  compatible et des contrôles d’accès à nouveau validés.

## Conditions de réouverture

Authentification réelle, sauvegarde/rechargement, conflit de révision,
isolation intercomptes/interéquipes, administration limitée, paramètres,
rechargement direct des routes et services réellement utilisés vérifiés.
Les tests avec fixtures restent sur la cible locale ou de test, jamais sur les
comptes de production. La création du compte principal et son attribution de
droits restent une opération séparée, basée sur son UUID Auth confirmé.
