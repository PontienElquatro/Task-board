# Ma’at : restructuration progressive

## Identité et compatibilité

Les SVG de public/brand reprennent les formes et les couleurs du fichier fourni deepseek_html_20261001_b20f90.html. Les variantes clair/sombre sont partagées via BrandComponent. La palette générale et la police système de l'interface restent inchangées.

Le nom visible est Ma’at. Les clés historiques mytaskboard_*, les tables et les fonctions taskboard_* restent volontairement inchangées pour ne pas perdre les données ou rompre les services déployés. Les exports de tâches utilisent Maat version 2 et les imports acceptent également MyTaskBoard version 2.

## Organisation

- core/brand.ts : identité partagée.
- core/storage : logique pure de sauvegarde de secours, testable sans réseau.
- shared/brand : composant de marque accessible clair/sombre.
- shared/filter-bar : présentation des filtres, reliée aux mêmes signals existants sans duplication d'état.
- providers : adaptateurs de persistance existants, compatibles avec StorageProvider.
- services : logique métier existante, conservée.
- .github/workflows/quality.yml : build et tests automatiques, à activer par publication du code.

## Fiabilité livrée dans ce lot

La récupération du cloud crée une copie séparée par compte avant toute lecture distante. Un échec réseau ou de stockage conserve l'état local et le conflit. La nouvelle version est persistée avant de remplacer l'état visible. L'export de secours contient les données de l'espace et aucune session ou clé d'authentification. Une seule copie de secours par compte est conservée sur cet appareil ; ce n'est pas un service de sauvegarde distante.

Les erreurs de synchronisation déclenchent une reprise automatique (2 secondes, délai exponentiel jusqu'à 60 secondes). Les changements de compte et la destruction du service annulent les temporisateurs. Les conflits restent explicites, sans fusion destructive.

Le format d'export et sa validation sont isolés dans core/storage/task-backup. L'import du tableau accepte les anciennes sauvegardes, les exports Ma’at et les tâches d'une copie de secours. Cet import fusionne uniquement les nouvelles tâches par identifiant, sans remplacer les existantes ; il ne restaure pas les projets ou objectifs de la copie de secours.

## Travaux suivants — non livrés dans ce lot

1. Compléter la synchronisation multi-onglets du lot 3 : tests cloud de bout en bout, restauration guidée et file d'opérations.
2. Migrations SQL reproductibles et tests RLS inter-comptes. Le SQL actuel n'est pas rejoué sur la production.
3. Durcissement CAS contre les écritures directes : concevoir et tester une interface serveur correctement autorisée avant de révoquer des droits.
4. MFA admin, rôles liés aux identifiants, limite de requêtes atomique et recherche globale.
5. SMTP avec domaine vérifié, tests email et parcours suppression du compte.
6. Modèle relationnel lorsque collaboration, pagination et gros volumes le nécessitent.
7. Fonctionnalités Aujourd'hui, récurrences et rappels.

## Lot 2 — comparaison et fusion

core/storage/workspace-merge fournit une fusion trois voies par identifiant pour tâches, projets et objectifs. Les modifications de deux éléments différents, ajouts indépendants et suppressions d'éléments inchangés sont réunis automatiquement. Deux modifications du même élément, ou suppression contre modification, imposent un choix explicite. Il n'y a pas de fusion champ par champ ou de sous-tâches indépendante.

Le cache conserve désormais base, dernière version confirmée du cloud. Les caches historiques non synchronisés sans base restent récupérables manuellement et ne sont jamais fusionnés par supposition.

Une copie de secours locale est créée avant fusion ou résolution. Les choix sont sauvegardés localement, puis soumis à la fonction CAS existante avec la révision comparée. Si le cloud change encore, une nouvelle comparaison est effectuée ; le serveur n'est pas écrasé avec une révision périmée. Aucun changement SQL n'est inclus dans ce lot.

shared/sync-conflict présente les versions et exige un choix pour chaque conflit. La comparaison lisible garde un volet de données complètes. Les suppressions sont explicitement signalées. La synchronisation multi-onglets et le remplacement de localStorage restent à implémenter ; ce lot traite les versions concurrentes détectées lors d'une synchronisation.

## Lot 3 — coordination des onglets et copies de l'appareil

Les événements storage et BroadcastChannel déclenchent une actualisation différée. Une boîte de dialogue ouverte retarde cette actualisation pour préserver le formulaire. Les messages BroadcastChannel contiennent seulement l'identifiant du compte et de l'onglet, jamais les tâches.

Web Locks coordonne les synchronisations cloud du même compte et de la même origine. Lorsque cette API est absente, la comparaison de révision CAS existante reste utilisée. Ce verrou n'est pas un contrôle d'autorisation et ne coordonne pas les autres appareils.

Chaque modification est journalisée séparément par compte et onglet avant l'écriture du cache partagé. IndexedDB conserve ensuite la dernière copie de chaque onglet ; seule la fin de transaction confirme cette copie. Une panne IndexedDB est signalée sans bloquer les écritures localStorage existantes. Le nettoyage optionnel des journaux ne remet pas en cause une transaction réussie.

En mode local, une modification du stockage depuis la dernière lecture provoque un refus d'écriture pour éviter d'écraser une version connue plus récente. Cette vérification n'est pas une transaction atomique entre onglets. localStorage reste la persistance principale et sa saturation peut toujours empêcher une modification.

Si le cache cloud principal est absent, le chargement cherche une copie IndexedDB du compte, en privilégiant une copie en attente. Les copies multiples ne sont pas toutes fusionnées automatiquement. Les journaux des anciens onglets restent exportables mais ne sont pas automatiquement rejoués.

Le bouton Copies de cet appareil exporte les copies et journaux du compte courant, ou de l'espace local. Le format Maat version 3 device-copies est distinct de l'import ordinaire des tâches. Le lot 4 ajoute un parcours dédié Récupérer une copie : validation du compte, fichier limité à 10 Mo, sélection d'une version, aperçu et ajout des identifiants absents uniquement. Les tâches existantes ne sont jamais remplacées. Les projets et objectifs ne sont pas restaurés ; les références éventuelles vers ceux-ci ne garantissent pas leur présence. Une restauration complète avec comparaison des éléments existants reste à concevoir.

Ces copies sont locales, non chiffrées, sans session d'authentification ajoutée. Elles ne constituent ni un historique complet ni une sauvegarde distante ; le navigateur peut les supprimer. Une politique de rétention et de purge sur appareil partagé reste à définir.

## Lot 5 — concurrence et audit de sécurité

Le script tools/test-cloud-browser.mjs vérifie le build local avec deux onglets, Web Locks réel et un backend intercepté : fusion d'éléments distincts, actualisation des deux vues, formulaire conservé, conflit explicite avant toute écriture et refus admin pour un compte ordinaire. Les destinations réseau non locales sont bloquées/interceptées. Ces scénarios ne testent pas l'autorisation réelle de Supabase.

Les tests Angular couvrent aussi le rejet CAS, l'absence d'écritures simultanées par provider et les réponses tardives cloud/admin après déconnexion. La fonction admin rejette maintenant les corps JSON non objets, tableaux et champs non prévus. Les erreurs de lecture de permissions et d'audit restent bloquantes. La limitation admin reste non atomique et les droits reposent encore sur la liste d'emails confirmés.

L'audit en lecture seule des catalogues du projet MyTaskBoard confirme RLS actif, politiques par propriétaire, absence de droits clients sur les tables admin et d'exécution anonyme des fonctions de sauvegarde. L'analyseur de sécurité Supabase ne retourne aucune alerte. Il confirme néanmoins les droits INSERT/UPDATE directs sur taskboard_workspaces : ils contournent le protocole CAS. La fonction SECURITY INVOKER actuelle dépend de ces mêmes droits. Aucun droit n'a été changé.

La correction doit être validée sur un environnement isolé : séparer l'autorisation d'écriture, conserver le contrôle auth.uid/compte, valider taille et révision, puis tester les refus inter-comptes et anonymes, la concurrence atomique et les écritures directes avant toute migration. Les tests serveur avec deux véritables identités ne sont pas encore réalisés. La production n'a reçu aucune écriture, déploiement ou migration de ce lot.

## Lot 6 — validation serveur isolée

Le projet gratuit Maat-test est distinct de MyTaskBoard. Les schémas de départ et le candidat database/workspaces-cas-hardening.sql y sont installés. Ce candidat conserve le point d'entrée public SECURITY INVOKER, délègue l'écriture à une fonction privée détenue par un rôle NOLOGIN sans BYPASSRLS, et retire INSERT/UPDATE/DELETE aux clients. Le rôle interne hérite des helpers du rôle authenticated mais les clients n'héritent pas de lui ; il n'est pas propriétaire de la table et reste soumis à RLS.

Les fichiers workspaces-test-fixtures.sql, workspaces-security-test.sql et workspaces-race-test.sql décrivent les fixtures et tests. Ils sont réservés à Maat-test. Les tests RLS SQL ont validé les contrôles de visibilité et 19 refus attendus. Deux transactions lancées en parallèle ont donné un succès à la révision 2 et un rejet 40001. Les identités sont synthétiques sans sessions Auth : la couche HTTP/PostgREST avec JWT réellement vérifiés reste à tester.

Aucun changement n'est appliqué en production et le frontend pointe toujours vers MyTaskBoard. Le CLI est absent : ces fichiers ne sont pas des migrations générées/versionnées. Ne pas rejouer automatiquement le candidat ni modifier les droits de production avant génération et répétition de la migration. La protection Auth contre les mots de passe compromis est signalée désactivée par l'analyseur, sans passage à un forfait payant.

## Publication des changements

Ces lots ne renomment ni le dépôt GitHub ni le projet Vercel ni la base Supabase et ne publient aucun changement automatiquement. Tester une preview avant la production et une restauration de sauvegarde avant toute migration.
