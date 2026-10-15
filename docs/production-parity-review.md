# Revue de parité — 15 octobre 2026

## Mise à jour du 16 octobre

La répétition `production-rehearsal-jWKkLh` a réussi, calendrier et protections
processing inclus, puis PostgreSQL a été arrêté normalement. Nouvel audit :
141 clés manquantes, 1 ajout et 9 objets modifiés (8 empreintes de fonctions et
RLS de la configuration de suppression). Le détail ci-dessous conserve le
premier état pour traçabilité ; les deux dates et les deux guards ne manquent plus.

Lecture des huit définitions sur Maat-test, sans modification distante :

- guard_processing_owner/admin : mêmes verrous auth.users FOR KEY SHARE,
  recherche processing, exception 42501 et retour NEW ; mise en forme différente.
- manage_taskboard_member : garde active identique ; message local « Account
  unavailable » plutôt que le message français. Gestion propriétaire/admin et
  rôles inchangée.
- progress_taskboard_work privé : même contrôle actif (message différent),
  validations, verrouillage du parent, revalidation et mise à jour du travail.
- save_workspace : même garde active (message différent), identité, validation
  de révision/payload, CAS et erreur PT409 ; sauts de ligne différents.
- taskboard_manage_team : même prédicat actif et propriétaire/ou administrateur,
  avec un saut de ligne supplémentaire.
- wrappers publics : délégation identique ; arguments nommés au lieu de $1/$2/$3
  pour progress_taskboard_work, SELECT void au lieu de SELECT * ; aucune valeur
  métier retournée par la fonction privée. Espacement pour save_workspace.

Ce constat résulte d'une lecture des corps, pas d'une équivalence SQL automatisée.
Les tests locaux réussis étayent les parcours mais ne prouvent pas la concurrence
multisession, la livraison Realtime ni le fonctionnement des services distants.

Compatibilité des omissions : le frontend ne référence pas claim_token,
retry_after, email_assignment_version ni les tables privées email/purge. Son
écran notification-preferences annonce explicitement les emails « en préparation »
et lit la colonne email_assignments présente. Le worker account-deletion-worker,
en revanche, appelle taskboard_claim_account_deletions_v2 et taskboard_deletion_step :
il ne doit donc pas être déployé/activé avec ce candidat. Les demandes et l'exécution
de suppression restent désactivées. Vérifier cet état sur les services réels avant
la publication ; une simple recherche de code ne vérifie pas leur configuration.

L'octroi explicite account_can_operate au writer est conservé : il matérialise
la dépendance de sauvegarde, sans donner de droit à un nouveau rôle public.
Les permissions retirées au catalogue test ne seront pas rétablies par parité.

`tools/release-candidate.mjs` assemble maintenant les six étapes avec un unique
BEGIN/COMMIT et une empreinte SHA-256. Ses deux tests passent. La commande
`--atomic-candidate` restaure la sauvegarde locale, applique cette forme exacte,
relance les tests compatibles avec l'état final et produit un nouvel audit.
Cette répétition reste à exécuter. Les suites des états intermédiaires ne sont pas
réexécutées dans ce mode car certaines exigent volontairement des fonctionnalités
encore désactivées. La version CLI de migration et l'approbation distante restent
à préparer après validation ; ce fichier n'est pas une autorisation de déploiement.

Source locale : `tmp/production-rehearsal-2k8BgV/parity-report.json`.
Tous les tests de comportement des lots ont réussi et le serveur local s’est
arrêté normalement. Cela ne vaut pas approbation de mise en production.

## Résultat et classification

150 clés manquantes, 1 ajout et 7 attributs modifiés. Une table omise produit
plusieurs clés (colonnes, index, contraintes, permissions) : ce ne sont pas
150 fonctionnalités absentes.

| Catégorie | Manquants | Ajouts | Modifiés |
| --- | ---: | ---: | ---: |
| Colonnes | 22 | 0 | 0 |
| Contraintes | 14 | 0 | 0 |
| Fonctions | 14 | 0 | 6 |
| Privilèges de fonction | 23 | 1 | 0 |
| Index | 9 | 0 | 0 |
| Politiques | 1 | 0 | 0 |
| Privilèges de table | 57 | 0 | 0 |
| Tables | 3 | 0 | 1 |
| Triggers | 7 | 0 | 0 |
| Privilèges de colonne | 0 | 0 | 0 |

### Écart fonctionnel à corriger

`public.taskboard_shared_tasks.start_date` et `end_date` ainsi que la contrainte
`shared_tasks_schedule_order` manquent. Le script `database/calendar-scheduling.sql`
doit être intégré et testé ; l’application utilise ces champs.

### Omissions volontaires de services désactivés

- Deux tables de préparation email, leurs index/contraintes/triggers et les
  révisions d’attribution : aucun expéditeur ni worker n’est disponible.
  Le choix email existe déjà dans le candidat et reste false par défaut.
- Réservation, journal et étapes de purge, secrets et invocation du worker :
  la purge et les demandes restent désactivées. Les colonnes attempts,
  claim_token et retry_after sont liées à ce traitement.
- La politique de lecture du journal de purge dépend de la table omise.

Ces omissions doivent être examinées par rapport aux parcours UI/Edge Functions
effectivement publiés ; le seul fait qu’un service soit désactivé ne suffit pas
à prouver la compatibilité. Aucun déploiement de worker ne doit précéder son schéma.

### Renforcements à conserver, pas à « corriger » par alignement

Le catalogue de référence Maat-test contient notamment TRUNCATE pour authenticated
sur équipes, membres, invitations, projets, tâches, sous-tâches et notifications.
TRUNCATE ne bénéficie pas de l’isolation par ligne de RLS : ces droits ne doivent
pas être copiés en production. Le candidat remplace les droits généraux par les
permissions minimales et teste déjà l’absence de TRUNCATE pour tâches et sous-tâches.
INSERT/DELETE et les droits de maintenance des notifications sont aussi retirés.

La configuration des suppressions a RLS en local (false dans la référence) et
n’est plus modifiable par service_role. Le candidat retire également à ce rôle
l’exécution directe de deux anciennes fonctions de trigger publiques.
Ces choix sont intentionnels ; aucune permission distante n’a été modifiée.
L’assainissement de Maat-test reste une opération distincte à organiser.

### Ajout à justifier

Le rôle technique `maat_workspace_writer` reçoit EXECUTE sur
`maat_private.account_can_operate()`. Il hérite déjà du rôle authenticated,
mais cet octroi explicite diffère du catalogue distant. Examiner si l’on
conserve l’octroi explicite ou l’héritage ; ne pas modifier le rôle pour effacer
un écart sans retester la sauvegarde et la suspension.

### Définitions de fonctions à examiner

Six empreintes diffèrent : manage_taskboard_member, progress_taskboard_work,
save_workspace, taskboard_manage_team côté privé ; progress_taskboard_work et
save_taskboard_workspace_for_user côté public. Propriétaires, mode definer/invoker
et search_path comparés sont identiques. Le rapport ne conserve pas les corps :
examiner les définitions avant de conclure à des écarts purement textuels.

Les triggers `maat_guard_processing_owner` et `maat_guard_processing_admin`
manquent aussi : même sans purge automatique, revoir les protections empêchant
une attribution de propriété/droits pendant un état processing. Ils ne doivent
pas être classés comme différences cosmétiques.

## Suite requise

1. Ajouter/tester calendrier et protections processing applicables sans worker.
2. Examiner les six corps de fonction et tous les écarts de sécurité restants.
3. Documenter la compatibilité du périmètre sans emails/purge avec le frontend
   et les fonctions Edge réellement destinés à la production.
4. Figer une migration versionnée, répéter sa forme exacte et valider le plan
   de retour arrière avant toute application distante.

Ni Maat-test ni MyTaskBoard n’ont été modifiés par cet audit.
