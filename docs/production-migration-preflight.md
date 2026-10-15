# Production Ma’at — préparation du 15 octobre 2026

## Cibles

- Production : MyTaskBoard, `nzdfuhozeiexvtrryndk`.
- Test : Maat-test, `fuvbwupoilkkawqhhdns`.
- Transférer uniquement la structure applicative revue, jamais les comptes, équipes,
  tâches, invitations, rôles attribués ou secrets de test.

## Sauvegarde vérifiée

Archive locale hors dépôt :
`C:/Users/DELL/Documents/Ma-at-backups/20261015-123017/MyTaskBoard.dump`.

- Taille : 381744 octets.
- SHA-256 : `37B494B27FCB3EDE7F20A86064CE051E0889D080330A38339A1013020324FCBC`.
- Format CUSTOM, pg_dump et serveur PostgreSQL 17.11.
- Catalogue fourni par l’utilisateur : 602 entrées.
- Lecture intégrale avec `pg_restore --file=NUL` : code de sortie 0.
- Aucune restauration exécutée. La lecture intégrale ne constitue pas un test
  de restauration ni une validation des permissions de restauration Supabase.
- L’archive peut contenir des informations sensibles : ne pas la versionner,
  la joindre au chat ou la publier. Conserver une copie protégée hors du poste.
- Les binaires Storage ne sont pas inclus dans un dump PostgreSQL.

## Inventaire courant en lecture seule

Contrôle du 15 octobre, distinct de l’instantané de sauvegarde :

- 0 utilisateur Auth ; 0 espace de travail ; 0 bucket et 0 objet Storage.
- Tables publiques : `taskboard_workspaces`, `taskboard_admin_allowlist`,
  `taskboard_admin_audit` ; 2 fonctions publiques.
- Le projet de test possède 18 tables applicatives supplémentaires.

Ces comptes sont propres à cette production. Les sessions et comptes utilisés
sur les previews de test ne prouvent pas l’existence d’un compte de production.

## Conditions avant application

1. Extraire et comparer la structure effective, les contraintes, fonctions,
   propriétaires, privilèges, politiques RLS, triggers et publications Realtime.
2. Préparer une migration versionnée correspondant à l’état actuel de production.
   Les scripts SQL historiques ne sont pas une chaîne à rejouer aveuglément.
   Exclure toutes les fixtures et tous les scripts de tests.
3. Répéter la migration et les contrôles sur une cible isolée appropriée ; ne pas
   écraser Maat-test et ne pas créer de ressource payante sans autorisation.
4. Définir le retour arrière : compatibilité de l’ancien frontend, sauvegarde
   fraîche si des écritures surviennent, restauration répétée et limites explicites.
   Ne jamais restaurer toute l’archive dans la production pour simplement tester.
5. Préserver les clés API ; préparer les fonctions Edge et configurations Auth
   séparément. Garder les emails applicatifs et suppressions automatiques désactivés.
6. Vérifier le compte administrateur de production par son identifiant Auth réel,
   sans copier l’identifiant du compte de test ni attribuer un rôle implicitement.
7. Après application : vérifier RLS et droits, isolation intercomptes,
   sauvegarde/rechargement, collaboration, administration et routes publiques.

## État

Sauvegarde lisible et inventaire initial vérifiés. Migration non générée,
non répétée et non appliquée ; production inchangée par ces contrôles.

## Comparaison approfondie du 15 octobre

Inventaire des catalogues, sans lecture des données métier :

| Élément | Production | Test |
| --- | ---: | ---: |
| Fonctions public/maat_private | 2 | 57 |
| Politiques public/maat_private/storage | 5 | 51 |
| Colonnes public/maat_private | 10 | 121 |

- `save_taskboard_workspace_for_user(uuid,bigint,jsonb)` existe dans les deux
  bases mais sa définition diffère. L’ancienne fonction de compatibilité
  `save_taskboard_workspace(bigint,jsonb)` est identique.
- Le rôle `maat_workspace_writer` est absent de production ; en test il est
  NOLOGIN, sans privilège superuser ni contournement de RLS. Préserver cette
  séparation lors de la migration des sauvegardes concurrentes.
- Trois colonnes doivent compléter l’audit existant : `target_id`, `reason`,
  `auth_sync`. Ne pas recréer ou vider cette table.
- Trois tables sont publiées en Realtime sur le test : tâches partagées,
  sous-tâches et notifications. Aucune table publique publiée en production
  lors du contrôle ; préparer cet ajout explicitement.

### Obstacles identifiés dans les scripts historiques

1. `database/admin-access.sql` mêle DDL et initialisation des droits. Il lève
   `Confirmed initial principal missing` si le compte principal confirmé
   n’existe pas. La production n’a actuellement aucun compte : séparer le DDL
   du bootstrap, sans copier d’UUID ni accorder des droits aux comptes de test.
2. `database/account-deletion-scheduler.sql` contient une URL fixe vers Maat-test.
   Ne pas appliquer ce script à la production. Le scheduler et les secrets
   nécessitent une configuration propre à la cible ; garder le traitement
   désactivé et ne pas créer de job avec une URL de test.
3. Le snapshot de structure ne suffit pas : les singletons de configuration
   devront être initialisés explicitement avec les valeurs sûres, sans copier
   les données des tables privées du test.

### Découpage du candidat à construire

1. Préconditions et sauvegarde ; rôle technique et schéma privé.
2. Structure collaboration, préférences, audit et sécurité, fonctions finales,
   triggers, ACL et RLS ; aucune fixture et aucun bootstrap d’administrateur.
3. Configurations neuves : emails et exécution des suppressions désactivés.
   Realtime limité aux trois tables attendues.
4. Répétition isolée, comparaison des catalogues et tests d’isolation.
5. Bootstrap séparé du principal après création et confirmation de son compte
   Auth de production ; vérifier son UUID et l’autorisation avant attribution.
6. Déploiement coordonné des fonctions Edge et du frontend, puis contrôles réels.

Ce découpage est un plan, pas une migration SQL exécutable ou validée.

## Répétition locale : outil et premier essai

`tools/rehearse-production-restore.mjs` vérifie l’empreinte de l’archive,
initialise un cluster neuf sous `tmp/production-rehearsal-*`, utilise un secret
local aléatoire avec SCRAM et écoute uniquement sur 127.0.0.1:55439.
Il ne contient aucune connexion distante et ne lance aucune migration.
Il restaure uniquement les schémas Auth/public avec propriétaires et ACL,
puis arrête le serveur dans le chemin normal et en cas d’erreur après démarrage.
Les extensions/services propres à Supabase restent hors de cette répétition.

Premier essai agent : initdb a terminé, mais pg_ctl a refusé le démarrage :
`could not create restricted token: error code 87` / `could not start server: error code 3`.
Aucun processus postgres/initdb ne subsistait au contrôle après cet échec.
La restauration n’a donc pas commencé. Ne pas interpréter la création du cluster
comme une restauration réussie. Prochaine vérification : exécuter le même outil
dans le terminal utilisateur, sans élévation et sans modifier les ACL Windows.

### Restauration locale réussie et candidat workspace

Après correction de l’attente des pipes Windows, suppression des variables de
service libpq vides et préparation du schéma Auth, l’utilisateur a obtenu :
`PASS local Auth/public restoration with owners and ACLs: {"users":0,"workspaces":0,"tables":3}`.
Dossier : `tmp/production-rehearsal-iqPU4G`. Le serveur a été arrêté normalement.
La restauration filtrée omet les ACL des schémas eux-mêmes : le runner les
complète désormais pour USAGE sur auth/public, vérifié en lecture seule sur
la production pour anon/authenticated/service_role. Ce n’est pas un clone de
tous les rôles, extensions, services et paramètres gérés par Supabase.

Le candidat `database/candidates/workspace-foundation.sql` prépare uniquement
la sauvegarde CAS et le rôle d’écriture soumis à RLS. Il est volontairement
non rejouable sur une base déjà équipée du schéma privé ou du rôle technique.
Il ne constitue pas encore la migration complète, ni un fichier versionné CLI.
Les gardes de suspension/suppression des comptes restent un lot ultérieur.

Commande locale : `node tools/rehearse-production-restore.mjs --workspace-foundation`.
Elle recrée une cible indépendante à partir de la sauvegarde, applique le candidat,
exécute les assertions existantes de sécurité avec deux fixtures locales sans
mot de passe dans une transaction annulée, vérifie 19 refus attendus et l’absence
de fixtures persistantes, puis arrête le serveur. Aucun appel réseau distant.

État du candidat : contrôle syntaxique JavaScript réussi ; nombre des assertions
vérifié statiquement. Exécution SQL du candidat encore à confirmer dans le terminal
utilisateur, le démarrage serveur étant refusé dans l’environnement agent.

Premier essai du candidat : DDL appliquée localement, mais premier INSERT de
workspace refusé lors du contrôle de clé étrangère vers Auth. Cause identifiée :
l’ACL de schéma omise par le restore filtré concernait aussi le propriétaire de
`auth.users`, `supabase_auth_admin`. Son droit USAGE sur auth a été confirmé en
lecture seule sur la production puis ajouté au bootstrap local. Aucun droit
supplémentaire aux clients, aucun changement du candidat pour contourner le test.
Le serveur local a été arrêté normalement ; suite à relancer après cette correction.

### Workspace validé ; collaboration core à répéter

L’utilisateur a ensuite obtenu le succès workspace dans
`tmp/production-rehearsal-jrU8tP` : 19 refus attendus, contrôles de révision et
d’isolation, fixtures annulées, serveur arrêté normalement.

Le sous-lot suivant est construit par `tools/collaboration-core-candidate.mjs` :
quatre sources structurelles relues (teams, team-management, team-roles,
shared-projects), regroupées dans une transaction avec durées bornées.
Il complète l’enregistrement atomique du propriétaire, interdit les écritures
directes de membres et déplace cinq fonctions privilégiées derrière des wrappers
publics invoker. Les empreintes des sources et le candidat assemblé restent
dans le dossier local de répétition.

Les invitations sont volontairement inaccessibles, y compris via leurs RPC.
Les privilèges généraux hérités sont révoqués puis remplacés par DML explicites
sur équipes/projets/tâches et SELECT seul sur les membres. Les tests vérifient
notamment qu’authenticated n’a pas TRUNCATE sur les tâches.

Commande locale : `node tools/rehearse-production-restore.mjs --collaboration-core`.
Ce mode restaure une cible neuve, répète workspace, applique ce sous-lot, puis
teste propriétaire/admin/membre/lecteur/tiers, masquage interéquipes, interdiction
de promotion par un admin, révocation immédiate et fonctions publiques restreintes.
Fixtures annulées, aucune ressource distante créée, serveur arrêté en fin d’essai.

Deux tests Node du générateur et contrôle syntaxique du runner réussis. Les tests
SQL collaboration ne sont pas encore exécutés. Ce candidat intermédiaire n’est
pas déployable en production : cycle d’invitation durci, notifications,
cycle de vie/suspension des comptes et parité avec la structure finale restent
à ajouter et à tester avant génération de la migration versionnée.

### Collaboration core validé ; invitations à répéter

Résultat utilisateur : `tmp/production-rehearsal-A1zHRi`, succès workspace et
collaboration core, fixtures annulées et arrêt normal du serveur.

`--invitations` répète ces lots, puis applique le candidat intermédiaire construit
par `tools/invitation-candidate.mjs`. Il rassemble le durcissement existant des
invitations et les profils d’équipe, avec une table de suspension, des helpers
privés et des politiques restrictives adaptées aux tables déjà présentes.
Le garde de traitement des suppressions sera ajouté avec le cycle de vie complet.
Ce n’est pas encore la structure finale approuvée pour production.

Le test existant `database/test-team-security.sql` couvre destinataire, retrait
des droits de l’émetteur, expiration maximale à la création, marqueur accepté
non forgeable, acceptation valide/idempotente, refus de rejoindre après retrait,
annulation et isolation. Un test local complémentaire vérifie adresse non
confirmée, expiration réelle, jeton nul/incorrect, suspensions de l’émetteur ou
du destinataire, interdiction de modification directe et refus anonyme.
Toutes les fixtures sont en transaction annulée ; le runner vérifie que les
comptes, équipes, invitations et états de suspension restent vides.

Quatre tests Node des deux générateurs réussis et syntaxe du runner vérifiée.
Exécution SQL des invitations encore à confirmer dans le terminal utilisateur.
Aucun handler email, scheduler, secret distant, donnée de test ou rôle attribué
n’est transféré. Aucun changement de production.

### Invitations validées ; notifications internes à répéter

Succès utilisateur dans `tmp/production-rehearsal-ICz37b` : tous les lots
précédents et les deux suites invitations ont terminé, fixtures annulées,
aucun email, serveur arrêté normalement.

Le mode `--notifications` rejoue les étapes précédentes puis assemble neuf
sources relues dans une transaction. L’ordre applique les définitions finales
de navigation avant les patchs de préférences, pour ne pas écraser ces gardes.
Le candidat inclut sous-tâches, synchronisation de checklist, attribution,
achèvement, cibles de navigation, lecture/masquage et préférences indépendantes.
Le choix email est présent mais false par défaut ; ni outbox ni worker email
n’est installé par ce sous-lot. Les gardes complets de suppression des comptes,
la partie administration et la parité finale restent des étapes distinctes.

Le runner ajoute deux membres synthétiques dans la transaction annulée des
tests préférences/navigation : les tests ne dépendent d’aucune équipe réelle.
Les privilèges des nouvelles tables sont révoqués puis accordés explicitement :
seuls read_at/dismissed_at sont modifiables par le destinataire, aucun INSERT,
DELETE ou TRUNCATE client sur les notifications. La RPC de progression utilise
un wrapper invoker et une implémentation privée.

Sept tests Node des générateurs réussis ; syntaxe du runner vérifiée. Exécution
SQL du nouveau lot encore à confirmer dans le terminal utilisateur.
La publication locale est préparée avec wal_level=logical : les assertions
contrôlent uniquement le catalogue des trois tables attendues, sans émuler
Supabase Realtime ni prétendre vérifier une livraison WebSocket.

Commande locale : `node tools/rehearse-production-restore.mjs --notifications`.
Aucune connexion distante ou modification de production.

### Notifications validées ; administration/cycle de vie à répéter

Résultat utilisateur : `tmp/production-rehearsal-ig6WQJ`, lots précédents et
notifications réussis après qualification du nom de colonne du catalogue dans
le test de privilèges. Fixtures annulées, aucun email, serveur arrêté.

Le mode `--admin-lifecycle` ajoute la structure des demandes/annulations de
suppression, le garde des comptes en traitement ou supprimés, l’administration
par UUID et sessions vivantes, la délégation/transmission, les paramètres publics,
la modération, l’annuaire et les agrégats. Les colonnes d’audit sont ajoutées sans
vider l’historique existant. La suspension et le traitement bloquent aussi les
RPC privées de sauvegarde/progression et les accès au workspace.

Le générateur supprime explicitement le bloc historique de bootstrap du principal
et échoue si ce bloc change. Aucun administrateur réel n’est créé par la structure.
Les tests d’administration insèrent un principal synthétique dans leur propre
transaction annulée. Son identité ne remplace jamais le compte de production.

La table de configuration des suppressions est protégée par RLS et inaccessible
aux clients comme au service_role. enabled et execution_enabled restent false.
Aucun worker de réservation, purge, accès Storage, secret Vault, cron ou appel
HTTP n’est installé. Les tests activent temporairement la demande uniquement
dans une transaction annulée ; aucune suppression automatique n’est exécutée.
Cette fondation ne permet pas encore de proposer une suppression opérationnelle.

Dix tests Node des générateurs réussis ; syntaxe JavaScript vérifiée. Les suites
SQL admin-access, paramètres, annuaire, demandes de suppression, suspension et
gardes de cycle de vie doivent encore être exécutées par l’utilisateur.

Commande : `node tools/rehearse-production-restore.mjs --admin-lifecycle`.
Ce mode restaure une cible locale neuve, répète tous les lots, puis contrôle
l’absence finale de comptes/administrateurs/demandes temporaires et la purge
désactivée. Aucun changement de production. Parité finale, services Supabase
non reproduits et génération de migration versionnée restent à traiter.

### Administration validée ; audit de parité préparé

Succès utilisateur complet dans `tmp/production-rehearsal-Xb99Ab` : les cinq
suites administration/cycle de vie et les gardes finaux ont réussi, ainsi que
tous les lots précédents. Aucune fixture persistante, purge désactivée,
serveur arrêté normalement.

Référence de catalogue extraite en lecture seule de Maat-test le 15 octobre :
21 tables, 121 colonnes, 57 fonctions, 46 politiques applicatives (hors Storage),
17 triggers applicatifs, 85 contraintes et 42 index. Les privilèges de tables,
colonnes et fonctions sont également inclus. Aucun compte, tâche, configuration
métier, secret ou corps de fonction n’est copié dans cette référence ; seules
les empreintes de définitions sont conservées.

`--parity-audit` répète le candidat puis compare son catalogue local à cette
référence. Les différences sont écrites dans `parity-report.json` sous le dossier
de répétition : manquants, ajouts et attributs modifiés. Un hash différent peut
être purement textuel et exige une revue ; il n’est jamais ignoré automatiquement.
Les écarts de privilèges, RLS ou fonctions sont signalés même si intentionnels.
Le comparateur ne conclut pas à l’équivalence des services distants et ne lit
aucune donnée utilisateur. Treize tests Node réussis, syntaxe du runner validée.

Commande : `node tools/rehearse-production-restore.mjs --parity-audit`.
L’audit local complet reste à exécuter dans le terminal utilisateur. La référence
contient notamment des fondations email/worker volontairement absentes du candidat.
Le calendrier et les autres écarts applicatifs doivent être examinés avant de
figer la migration. Aucune approbation automatique fondée sur le compte des écarts.

Le document `docs/production-rollback-plan.md` décrit les conditions avant/après
COMMIT et les limites de restauration. Ce n’est pas encore une procédure distante
approuvée. Aucune migration versionnée finale n’a été créée ou appliquée.
