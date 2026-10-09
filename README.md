# Ma’at — L’équilibre de vos projets

Anciennement MyTaskBoard. L'identité utilise les logos fournis par le propriétaire. Les anciennes clés de stockage et les sauvegardes MyTaskBoard restent compatibles : aucun changement de nom des données n'est nécessaire.

La restructuration commence par le socle de fiabilité : marque partagée, sauvegarde de secours avant récupération cloud, reprise automatique après erreur réseau et contrôles GitHub Actions. Voir [l'architecture et les phases restantes](docs/ARCHITECTURE-MAAT.md).

Les instructions historiques ci-dessous mentionnent parfois MyTaskBoard et ses archives. Le mode cloud est assuré par CloudStorageProvider ; le mode sans compte conserve les données dans le navigateur.

Un tableau personnel de tâches, en français, construit avec Angular 20.3 et Tailwind CSS 4. La section « Version connectée et administration » ci-dessous décrit Supabase et les prérequis de mise en production.

## Démarrer

Utilisez Node.js 22 LTS et npm.

```sh
npm ci
npm start
```

Ouvrez http://localhost:4200. Le tableau démarre vide sur un nouveau navigateur. « Explorer un exemple » permet de découvrir cinq tâches, puis de les modifier ou d’annuler leur ajout.

### Version prête à lancer

L’archive `MyTaskBoard-fonctionnel-pret-a-lancer.zip` contient déjà l’application compilée. Extrayez l’archive, puis double-cliquez sur `Lancer-MyTaskBoard.cmd`. Seul Node.js est nécessaire, pas d’installation npm ni de compilation. Gardez la fenêtre ouverte et utilisez le même navigateur et l’adresse `http://localhost:4200` pour retrouver vos données. Si le port est occupé, fermez l’ancienne instance.

Pour le projet source, après `npm run build`, `npm run preview` utilise le même lanceur local. Ouvrir directement un fichier HTML ou une image de capture ne lance pas l’application.

## Fonctionnalités

- Kanban responsive unique : À faire, En cours, Terminé ; déplacement et classement persistants.
- Création, consultation, édition, sous-tâches, priorités et échéances.
- Sous-tâches cochables directement dans la fiche, changement de statut depuis la carte, suppression confirmée des tâches actives.
- Retour au tableau réinitialisant les filtres ; après enregistrement, les filtres sont effacés pour ne pas masquer la tâche.
- Une sous-tâche encore saisie est ajoutée lors de l’enregistrement. Avertissement avant fermeture de la page si l’édition n’est pas enregistrée.
- Notification des nouvelles versions disponibles, sans rechargement automatique pendant la saisie.
- Tags personnalisés ; recherche dans les titres, descriptions, tags et sous-tâches.
- Filtres par statut, priorité, tag, retard ou absence d’échéance.
- Tri manuel, priorité, échéance et date de création.
- Duplication, archivage, restauration et suppression confirmée depuis les archives.
- Annulation des 20 dernières modifications pendant la session.
- Export JSON des tâches actives et archivées ; import par fusion, sans remplacement des identifiants existants.
- Vue d’ensemble : progression, répartition des statuts, priorités et objectifs existants.
- Thèmes clair/sombre, navigation clavier, focus dans les dialogues, messages d’erreur et protection des modifications non enregistrées.
- Raccourcis : N pour créer une tâche, / pour chercher, Échap pour fermer le dialogue ou demander l’abandon des modifications.

Les déplacements sont désactivés lorsqu’un filtre ou un tri automatique est actif : l’ordre d’un sous-ensemble ne remplace ainsi pas celui du tableau complet. Le statut reste modifiable dans le formulaire.

## Données et sauvegardes

Les données sont conservées uniquement dans le localStorage du navigateur, sous les clés historiques `mytaskboard_tasks`, `mytaskboard_goals` et `mytaskboard_theme`. Les anciennes tâches sont migrées au chargement.

Exportez régulièrement les tâches, en particulier avant d’effacer les données du navigateur. L’export porte sur les tâches ; les définitions d’objectifs existants ne sont pas incluses. Il n’y a pas de compte, de synchronisation entre appareils ou de collaboration multiutilisateur.

L’import accepte le format V2 et les anciens tableaux JSON de tâches : au maximum 5 Mo par fichier et 10 000 tâches au total. Les identifiants déjà présents restent inchangés. Une sauvegarde invalide est refusée avant toute modification.

Si les données existantes sont corrompues, elles ne sont pas remplacées : les modifications sont bloquées et l’export télécharge leur contenu brut pour permettre une récupération manuelle. Si le stockage est plein ou indisponible, la modification n’est pas appliquée.

## Vérifier et compiler

```sh
npm run test:ci
npm run build
```

Les tests utilisent Chrome/Chromium. Si nécessaire, définissez `CHROME_BIN` avec le chemin du navigateur.

Le code serveur est conservé, mais les pages personnelles sont rendues côté client pour accéder au stockage local sans différence d’hydratation.

```sh
npm run serve:ssr:my-task-board
```

Le serveur sert le résultat compilé sur http://localhost:4000, ou le port indiqué par `PORT`.

Pour un hébergement statique, servez les fichiers de `dist/my-task-board/browser`, utilisez `index.csr.html` comme point d’entrée et configurez le retour vers cette page pour les routes de l’application. Aucune mise en ligne n’est effectuée par cette livraison.

## Organisation

- `models/task-utils.ts` : validation, migration, dates et déplacement immuable.
- `services/task.service.ts` : état réactif, persistance, filtres, archives, import et annulation.
- `providers/storage.provider.ts` : contrat de stockage injectable.
- `kanban-board`, `task-card`, `task-column`, `task-modal` : interface du tableau.
- `dashboard` : vue d’ensemble.
- `styles.css` : palette, composants, thème sombre et adaptations mobiles.

L’archive de livraison exclut les dépendances installées, les caches et la copie imbriquée présente dans le dossier de travail.
# Version connectée et administration (octobre 2026)

La version actuelle conserve la palette bleu/gris et la typographie système d’origine. Elle ajoute Supabase Auth, les espaces personnels synchronisés, les projets et `/admin`.

## Exécuter et vérifier

Utiliser Node 22.12+ (branche 22) ou Node 24. Angular et son CLI sont alignés sur la version 20.

```sh
npm ci
npm run build
npm run test:ci
npm run test:admin
npm run preview
```

## Tests cloud et sécurité — lot 5

`npm run test:cloud-browser` exécute les scénarios multi-onglets sur un build servi localement. Ce test nécessite Playwright disponible dans l'environnement de test ; `MAAT_PLAYWRIGHT_PATH` permet d'indiquer son module installé et `CHROME_BIN` un navigateur existant. `MAAT_TEST_URL` vaut par défaut `http://127.0.0.1:4213`. Les destinations non locales sont interceptées : le backend Supabase est simulé, sans appel ni écriture réels. Ces tests ne prouvent pas les politiques RLS de production et ne sont pas encore intégrés à la CI.

`database/security-audit.sql` audite en lecture seule les droits, RLS et fonctions. L'audit du 1 octobre confirme les protections par propriétaire et le refus d'accès client aux tables admin. Il révèle aussi des droits INSERT/UPDATE directs sur les espaces : ils permettent de contourner le protocole CAS, sans donner accès aux espaces des autres utilisateurs. Ne pas révoquer ces droits seuls : la fonction actuelle SECURITY INVOKER en dépend. Une solution contrôlée, testée sur une base isolée, est nécessaire avant publication. La limite admin demeure non atomique ; les rôles par identifiant et le MFA restent à réaliser.

## Administration — fonctionnement

Le dashboard présente les comptes paginés (50 par page), leur confirmation, leurs connexions, la dernière synchronisation et les 30 dernières consultations administratives. La recherche porte sur la page affichée. Il ne donne pas accès au contenu des tâches privées et ne permet pas de supprimer les comptes.

La fonction Supabase `taskboard-admin` vérifie chaque session avec `Auth.getUser`, exige un email confirmé et consulte la liste d’autorisation côté serveur. Ni `user_metadata`, ni une adresse fournie par le navigateur ne suffisent à obtenir ce rôle. Les adresses autorisées sont stockées en base et ne sont pas intégrées au frontend ni à ce dépôt. Pour ajouter ou retirer un administrateur, le propriétaire du projet gère `taskboard_admin_allowlist` depuis Supabase ; aucun client ne peut modifier cette table ou le journal. Le service utilise uniquement des secrets fournis par l’environnement Supabase, jamais une clé privilégiée intégrée au code. La limitation de consultations est de 30 par minute et par administrateur (protection simple, non atomique).

Les deux comptes validés par le propriétaire doivent être créés dans MyTaskBoard et confirmer leur email avant de pouvoir accéder à l’administration. Les autorisations sont déjà enregistrées dans la base cible.

`database/workspaces.sql` et `database/admin.sql` documentent le schéma. Ne pas les rejouer sur la base existante : les migrations y sont déjà appliquées. Le code de la fonction se trouve dans `supabase/functions/taskboard-admin/index.ts` ; sa validation JWT est explicitement réalisée dans le handler (`verify_jwt=false` dans `supabase/config.toml`).

## GitHub et Vercel

Le dépôt cible est `PontienElquatro/Task-board`, le projet Vercel `task-board-v1`. `vercel.json` impose `npm run build`, le dossier `dist/my-task-board/browser` et le fallback SPA `/index.csr.html`. Vérifier dans Vercel que le dépôt lié est bien celui-ci, que le dossier racine est vide et que la branche de production est `main`. Une branche de travail doit être testée en preview avant sa fusion ; ne pas utiliser une ancienne archive compilée.

La clé publishable Supabase incluse dans AuthService est publique par conception ; les règles RLS protègent les espaces. Ne jamais ajouter une clé service-role/secret, un token GitHub ou une clé SMTP au dépôt.

## Restant avant l’ouverture publique

- Configurer le SMTP (Resend + domaine vérifié) et tester confirmation/récupération réelles. Le SMTP Supabase par défaut ne convient pas aux inscriptions publiques.
- Configurer `Site URL` et les redirections Auth avec le domaine Vercel retenu, ainsi que `/login` et la récupération du mot de passe. Ne pas désactiver la confirmation email pour contourner ce travail.
- Valider les deux comptes admin réels. Les tests d’interface utilisent des données simulées, pas leurs comptes.
- Vérifier le commit publié, la preview puis la production Vercel. Une compilation locale ne prouve pas un déploiement.
- Définir les sauvegardes et la conservation des logs. L’export JSON actuel sauvegarde les tâches, pas les définitions des projets ni les objectifs ; le cache local est une aide hors ligne, pas une sauvegarde serveur.

Les instructions locales historiques ci-dessous restent utiles, mais les sections décrivant uniquement le stockage local ne couvrent pas le mode connecté.
