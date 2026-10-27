# Gel du candidat gratuit — 16 octobre 2026

## Preuve locale

- Répétition réussie : `tmp/production-rehearsal-izgCAQ`.
- Fichier conservé : `database/candidates/release-frozen.sql`.
- SHA-256 : `c221758f3f566d6fa9e0f863c65ad78aebaa4b11d4d9e5bc06f4a7a76ea46aa6`.
- 90 740 octets, LF ; copie strictement identique au SQL effectivement exécuté.
- Une transaction pour les six lots ; tests de l'état final réussis, fixtures
  annulées et serveur local arrêté normalement.
- Audit final : 141 manquants, 1 ajout, 9 modifiés, inchangé par rapport aux lots.
- Aucun Premium, envoi email, worker de purge ou administrateur réel initialisé.

Les tests de `tools/release-candidate.test.mjs` vérifient l'empreinte du fichier
figé et son égalité avec l'assemblage des sources. Toute modification nécessite
une nouvelle revue/répétition et une nouvelle empreinte, pas une mise à jour
silencieuse du résultat attendu.

## Contrôles distants en lecture seule du 16 octobre

Projet MyTaskBoard `nzdfuhozeiexvtrryndk` : quatre migrations historiques,
aucun schéma maat_private ni rôle maat_workspace_writer ; zéro utilisateur,
workspace, bucket ou objet Storage. Aucun lint de sécurité retourné par Advisors
sur ce schéma initial (ce n'est pas une validation du candidat non installé).

Une seule Edge Function déployée : taskboard-admin, version 2. Aucun worker de
purge/email déployé. La fonction admin doit encore être comparée à la version
du dépôt et mise à niveau séparément si nécessaire : la migration SQL ne déploie
pas les fonctions Edge. L'état réel Auth/Vercel, les redirections et le domaine
ne sont pas validés par ces requêtes.

## Barrières avant application

1. Créer le fichier versionné avec la CLI Supabase, sans connexion distante,
   puis y placer exactement le SQL figé et vérifier son empreinte.
2. Versionner les sources, tests, documentation et migration ; préserver les
   modifications sans rapport et ne jamais committer sauvegardes/cache/tmp.
3. Sauvegarde fraîche et fenêtre sans écritures ; vérifier l'historique et le
   schéma initial immédiatement avant application, ainsi que le plan de reprise.
4. Application contrôlée puis Advisors, tests HTTP/Auth/RLS/Realtime, fonction
   admin, frontend production et parcours mobile. Aucun compte de test copié.

Ne pas lancer `db push` aveuglément : les quatre migrations distantes initiales
ne figurent pas dans supabase/migrations. L'alignement de l'historique doit être
préparé explicitement ; ne pas marquer une migration appliquée avant son exécution.
Ce gel n'est pas une approbation de déploiement.

## Création locale du fichier versionné

CLI officielle 2.121.0 téléchargée dans le dossier temporaire isolé. Son lancement
dans le sandbox échoue sur la création de `C:/Users/DELL/.supabase`, même après
autorisation du dossier. Aucun fichier de migration versionné n'a donc encore été
créé. Le helper `tools/prepare-release-migration.mjs`, à lancer en PowerShell normal,
consulte les aides CLI, crée la migration avec `migration new`, remplit uniquement
le nouveau fichier vide et vérifie l'empreinte ci-dessus. Il ne demande aucune
connexion distante. Une réexécution accepte uniquement une migration déjà identique.

Résultat utilisateur confirmé : `supabase/migrations/20261015222551_maat_free_release.sql`
créé avec l'empreinte attendue. Vérification indépendante Get-FileHash identique.
Le blocage de création dans le sandbox est donc résolu par l'exécution utilisateur.

## Sauvegarde fraîche à réaliser

`node tools/backup-production.mjs` utilise pg_dump 17.11 en lecture seule,
demande le mot de passe au terminal, crée un nouveau dossier unique hors dépôt,
puis lit intégralement l'archive avec pg_restore vers NUL sans connexion de
restauration. Il écrit un manifeste sans identifiants secrets. Le contrôle
`--check` a réussi sans réseau ni création de sauvegarde ; la sauvegarde réelle
reste à exécuter par l'utilisateur. Ce contrôle de lisibilité n'est pas une
répétition de restauration. Aucune écriture distante n'est demandée par le script.

## Dernier précontrôle distant

Sauvegarde fraîche terminée et empreinte revérifiée indépendamment :
`C:/Users/DELL/Documents/Ma-at-backups/20261015T222939Z-80b34154/MyTaskBoard.dump`,
381 744 octets, SHA-256
`86220e94dae3ac714981d223c5e3120a74428b3e43ec7db78d37f7c75154d659`.
Son horodatage UTC correspond au 16 octobre à Paris.

Lecture distante : zéro utilisateurs, workspaces et objets Storage ; schéma privé
absent, deux entrées historiques dans l'allowlist. Les quatre migrations originales
ont été récupérées depuis schema_migrations.statements et ajoutées localement sous
leurs noms/versions existants, sans réexécution ni réparation de l'historique distant.
Elles conservent leur contenu historique, y compris l'ancienne allowlist ; ce ne
sont pas de nouvelles migrations ni une recommandation de sécurité pour une base neuve.

Lecture du code réellement déployé : taskboard-admin v2 valide Auth mais autorise
encore par email dans l'allowlist ; le dépôt utilise désormais l'identité UUID,
la session vivante et les permissions via taskboard_admin_access. Déployer la
fonction actuelle en coordination avec la migration SQL et avant ouverture ;
ne pas supposer que la migration SQL remplace le code Edge. Conserver la réponse
fermée 403/503 tant qu'aucun principal confirmé n'a été explicitement initialisé.
L'attribution des droits du compte réel reste une opération séparée.

Les fichiers locaux de préparation restent à committer/pousser avant application.
Aucune migration ni Edge Function distante n'a été modifiée par ces précontrôles.

## Backend installé — 16 octobre 2026 (Paris)

- CI réussie pour `945a1e1c5b486cc36e3dd78cbe9f7bd9e7bc0f87` :
  https://github.com/PontienElquatro/Task-board/actions/runs/38818124925.
- Fonction taskboard-admin v3 ACTIVE, code relu et identique au commit ;
  validation Auth.getUser puis session vivante/permissions côté SQL.
- Premier appel de migration : erreur de suivi MCP `Invalid or expired requestState`.
  Vérifications avant toute reprise : quatre migrations seulement, aucun schéma
  privé, rôle writer, équipes ou RPC admin. Après cette absence de changement
  constatée, nouvel appel réussi ; pas de relance aveugle.
- Migration distante enregistrée par Supabase : `20261015224615_maat_free_release`.
  Le fichier local est renommé de `20261015222551_maat_free_release.sql` vers
  `20261015224615_maat_free_release.sql` pour correspondre à l'historique réel.
  Aucun SQL métier modifié : empreinte c221758f…46aa6 inchangée. Ne pas conserver
  les deux versions ni exécuter une réparation artificielle de l'historique.
- Comparaison du catalogue installé avec la répétition `izgCAQ` : 0 manquant,
  0 supplémentaire, 0 modifié sur les dix catégories inventoriées.
- 18 tables public/privé, 45 fonctions ; zéro table publique sans RLS ;
  trois tables déclarées dans supabase_realtime (pas une preuve WebSocket).
- Zéro utilisateur, équipe, workspace, administrateur ou principal créé.
  Demandes de suppression et exécution de purge false ; aucun worker email/purge.
- HTTP réel : POST admin sans session 401 ; lecture anonyme des équipes 401.
- Advisors sécurité : quatre notices INFO RLS sans politique pour les tables
  privées account_deletion_config, admin_members, admin_control, admin_access_events.
  Ces tables sont volontairement fermées aux clients ; pas de politique permissive
  ajoutée pour masquer les notices. Référence :
  https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy.

Le backend est installé, pas la nouvelle version publique du frontend. L'aperçu
Vercel `task-board-v1-glchvm7ad-pontien-misengas-projects.vercel.app` est READY
pour 945a1e1 mais utilise le backend de test ; il ne doit pas être présenté comme
une validation de production. Le dernier frontend production est encore le commit
main `3d1b46330f65916179bcc144f37dcb04dab73b15`. Il reste à préparer un build
production, tester les redirections/Auth et les parcours connectés, initialiser
séparément le principal confirmé, puis publier/promouvoir le frontend et vérifier
les parcours métier. Le domaine souhaité n'est pas encore attribué.

## Initialisation du principal réel — 16 octobre 2026

Le propriétaire a remplacé son choix initial par `pontienmisenga93@gmail.com`,
puis confirmé sa connexion. Adresse de la session vérifiée dans l'interface ;
compte Auth confirmé, session vivante, aucun statut suspendu/suppression et aucun
administrateur/principal préexistant vérifiés côté serveur.

Initialisation transactionnelle par UUID Auth après verrouillage des tables de
contrôle : admin_members (les sept permissions), admin_control et événement
admin_access_events action bootstrap avec motif explicite. Aucune copie de rôle
depuis Maat-test, aucune attribution fondée sur les métadonnées de profil.
Résultat vérifié : un principal et un administrateur seulement ;
`quatrosus@gmail.com` absent de admin_members. Les anciennes entrées de l'allowlist
de compatibilité n'ont pas été modifiées, hormis le maintien de celle du principal.

Vérification navigateur réelle : /admin ouvre la console, affiche les deux comptes
confirmés et les sections Vue d'ensemble, Utilisateurs, Collaboration, Journal,
Paramètres et Rôles et accès. Aucun compte suspendu, aucun transfert ni délégation
effectué. L'interface des accès exige une confirmation de connexion avant de charger
et modifier les rôles ; aucun mot de passe n'a été saisi par l'agent.
Le domaine principal et le domaine Ma'at demandé restent à finaliser séparément.

## Publication du frontend et test réel — 16 octobre 2026

Déploiement production READY `dpl_5xDtvQHx7v4HNGoxBJ9AxJS7Qqay`, commit
`388705e3113fd588c10a687f6bcb56ac9c70f540`, Angular, source CLI issue de
l'export propre du commit. URL technique :
`https://task-board-v1-ilfru7vgl-pontien-misengas-projects.vercel.app`.
Logs : backend production nzdfuhozeiexvtrryndk, build complet ; avertissement
budget initial 743,73 kB pour 500 kB, non bloquant. Environ 54 s selon la CLI.

L'option CLI --skip-domain a tout de même attribué l'alias secondaire
task-board-v1-pontien-misengas-projects.vercel.app. Cette différence a été
signalée, pas présentée comme une absence totale d'attribution de domaine.

Après accord explicite du propriétaire : création unique de « Vérification
production Ma’at » dans l'espace personnel du principal ; attente du statut
Sauvegarde cloud confirmée ; rechargement et présence de la tâche confirmés ;
archivage, nouvelle attente cloud, rechargement puis ouverture Archives (1) :
tâche présente. Aucune autre tâche modifiée, aucune suppression définitive.
La tâche de contrôle reste volontairement dans les archives et peut être restaurée.
Les paramètres plateforme se chargent sans modification de formulaire.

Promotion du déploiement testé effectuée ; vérification par API que
`task-board-v1.vercel.app` pointe vers ce même déploiement, puis requête HTTP
anonyme /home : 200 avec `main-YGPKK4RM.js`, sans écran Vercel Authentication.
Adresse publiée : `https://task-board-v1.vercel.app`.

Tentative demandée d'attribution de `maat.vercel.app` refusée par Vercel avec
`alias_in_use` : nom déjà utilisé. Aucun forçage ni achat ; attendre le choix
d'une autre adresse avant toute attribution supplémentaire. Auth Site URL et
redirections ont été réglés par l'utilisateur sur l'adresse principale actuelle
et l'URL technique ; ils devront être revus lors du prochain changement de domaine.

Ces contrôles ne prétendent pas valider une livraison Realtime entre deux
comptes/équipes, un envoi email, un paiement ou une purge. Ces derniers services
restent hors périmètre/désactivés. Aucun scan complet de logs d'erreurs runtime
ni service externe de monitoring/drain n'a été configuré pendant cette publication.
Les corrections des helpers CLI et ce compte rendu local restent à versionner.
