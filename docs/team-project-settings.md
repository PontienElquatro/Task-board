# Paramètres des équipes et projets

Fonctionnalités : clôture et réouverture sans suppression, départ des membres,
transfert de propriété, nom/description et droits des projets. Les contrôles sont
appliqués côté serveur (RPC, RLS et triggers), pas seulement dans l’interface.

## Validation du 22 octobre 2026

- Répétition SQL locale sur restauration isolée : permissions, isolation,
  version concurrente, clôture, transfert, départ et conservation des travaux.
  Fixtures annulées, serveur local arrêté ; dernier dossier :
  `tmp/production-rehearsal-reJQfh`.
- Validation utilisateur `tmp/team-settings-validation-2wLmEL` : TypeScript,
  21 tests Chromium dans trois suites, compilation Angular réussie.
- Budget initial dépassé (745,27 ko pour 500 ko) : avertissement non bloquant.

## Publication

Source isolée `tmp/team-settings-release-9U9Ey3` : version publiée du 21 octobre
(`tmp/production-frontend-h7Z3qe`) et six fichiers des paramètres provenant du
snapshot validé. Empreintes dans `settings-release-manifest.json` du dossier.
Les autres modifications locales (notamment authentification et premium)
ne sont pas incluses. Aucun commit/push nouveau n’est déclaré.

Prévisualisation construite : `dpl_H5fVKY3tZ2BfHxopv37BLZMMrVWv`, READY.
Son backend est de test ; elle ne doit pas être promue telle quelle.

Migration distante `20261022120558_team_project_settings`, appliquée au projet
`nzdfuhozeiexvtrryndk` via le connecteur Supabase. Source exacte :
`database/candidates/team-project-settings.sql`, SHA-256
`5c99a2a24e860afe91b04da16c547f19b7b21785b9ce907e91113378ec1ed9a8`.
Contrôles après application : RLS activée, écriture directe des participants
interdite, RPC interdites à anon, appels sans identité refusés. Comptages avant
et après identiques : 1 équipe, 1 membre, 1 projet, aucune tâche/sous-tâche.
Aucun test sur une équipe réelle et aucune nouvelle sauvegarde complète créée
pendant cette publication (la sauvegarde historique reste celle du 15 octobre).

Build production READY : `dpl_AP7S3fCGnyUDc32FCvq1Wt1f5pCB`, Angular,
Node 24, environ 40 secondes de construction. Les journaux confirment le
backend de production. Les deux alias `maat-work.vercel.app` et
`task-board-v1.vercel.app` sont assignés à ce déploiement.

`node tools/verify-team-settings-public.mjs` : PASS sur les deux adresses,
routes `/home`, `/team`, `/team-projects` HTTP 200 sans redirection Vercel,
intégrité SHA-1 des 35 scripts de chaque manifeste vérifiée, marqueurs des
écrans et des RPC présents, backend de test absent. Aucune action authentifiée
sur une équipe réelle n’a été exécutée. Les scénarios fonctionnels sont couverts
par les tests locaux, pas par une manipulation réelle après publication.

Recherche de logs runtime error/fatal du nouveau déploiement sur 15 minutes :
aucun résultat. Cette observation n’est pas une preuve d’absence d’erreurs
JavaScript dans le navigateur ; aucun suivi d’erreurs navigateur n’a été ajouté.
Le connecteur Vercel a assuré la publication après un refus « Not authorized »
de la CLI. Aucun jeton ni mot de passe lu ou modifié.

Les conseillers sécurité ne signalent aucune nouvelle alerte : les quatre
tables privées restent sans politique (accès client refusé intentionnellement).
L’avertissement préexistant de protection contre les mots de passe compromis
désactivée demeure :
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Retour arrière

Conserver la migration additive en place et réassigner les deux alias publics
à `dpl_2VpEc9bQ2RPZ1wQobmPYPtt253eK` si un problème d’interface est constaté.
Ne pas supprimer les nouvelles tables/colonnes : elles peuvent contenir de
nouveaux réglages. L’ancienne interface conserve les restrictions serveur.
Ne pas utiliser le helper historique de staging, épinglé au commit antérieur,
pour republier cette version.
