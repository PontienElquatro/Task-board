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
