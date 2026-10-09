# Console Ma’at

La console admin supervise les comptes et l’adoption. Les tableaux des projets restent les espaces de travail Kanban des équipes.

## Fonctions disponibles

- Vue d’ensemble : comptes, espaces cloud, équipes et projets partagés.
- Adoption : confirmations et connexions sur 30 jours sur tous les comptes. L’annuaire est récupéré intégralement côté serveur puis projeté en champs sûrs ; recherche, tri et pagination de 50 comptes opèrent sur cet annuaire complet.
- Utilisateurs : recherche par email/ID, filtres par statut actif/suspendu, rôle/confirmation/synchronisation, tri, pagination, fiche modale accessible et copie d’identifiant. Le statut actif désigne l’absence de suspension, pas une présence en ligne.
- Fiche : statut visible et raccourci vers les événements du compte. Le journal filtre par cible et par action sur la page courante ; parcourir les pages pour retrouver les événements anciens. Ce raccourci n’est pas un historique exhaustif chargé en une seule requête.
- Collaboration : compteurs globaux, annuaire des équipes paginé par 50 (chargement à la demande), recherche sur la page et fiche avec propriétaire, effectifs, projets et invitations acceptées/en attente/expirées. Une invitation annulée ne figure plus dans ces totaux. Les adresses des invités, jetons et contenus de projets ne sont pas exposés. Les propriétaires gardent la gestion des rôles et invitations ; cet écran est une supervision en lecture seule.
- Journal : historique paginé par 30 consultations, recherche et export CSV de la page filtrée affichée. Les contrôles de rôle et la navigation vers les anciennes pages n’écrivent pas une nouvelle consultation.
- Paramètres : accès au profil et au mot de passe de l’administrateur.

## Accès aux données

La fonction Edge vérifie la session, la confirmation email et la liste d’administrateurs à chaque appel. La fonction SQL d’agrégation est SECURITY INVOKER et exécutable uniquement par service_role. Elle ne retourne ni titres de projets, ni tâches, ni emails d’invitation, ni jetons. Les noms des comptes ne sont pas ajoutés à la projection existante : les avatars utilisent les initiales de l’email.

## Suite du produit

Limites explicites : la récupération complète de l’annuaire est adaptée à la taille actuelle et plafonnée à 10 000 comptes (erreur explicite au-delà, jamais de chiffres partiels). À cette échelle, remplacer le chargement complet par un index administratif paginé côté serveur. La pagination du journal par décalage peut se déplacer en cas de nouvelles consultations concurrentes. Les compteurs ne remplacent pas une supervision technique ; celle-ci et l’audit des mutations sont des fonctionnalités futures.

Vérification locale : tools/test-admin-edge.mjs simule 1 051 comptes sur deux lots et la deuxième page du journal. tools/test-admin-ui.mjs vérifie trois pages sur 125 comptes, la recherche globale et l’échappement CSV (guillemets et formules). La réception du téléchargement dans le navigateur reste à vérifier sur le nouveau frontend déployé.

Suspension/réactivation : depuis la fiche d’un compte standard, confirmation avec motif de 10 à 500 caractères, contrôle de concurrence et audit transactionnel (auteur, cible, motif et date). Tous les comptes Admin sont protégés, ainsi que le compte de l’opérateur. Les données sont conservées.

La barrière immédiate est taskboard_account_status, vérifiée par les politiques restrictives sur les tables Ma’at, les écritures d’avatars et les RPC SECURITY DEFINER existantes. Le statut n’est pas dérivé de user_metadata ni d’un jeton pouvant être ancien. Auth est synchronisé via updateUserById/ban_duration (876000h ou none). Un échec de synchronisation est signalé à l’opérateur et inscrit dans le journal ; le statut DB reste autoritatif et ne fait jamais l’objet d’une réactivation automatique en compensation. Auth et Postgres ne sont pas une transaction distribuée : un échec/race de synchronisation Auth peut nécessiter une réparation par le propriétaire du backend. Aucun mot de passe n’est créé ou modifié.

La suspension bloque les requêtes serveur, pas les données déjà téléchargées ou conservées hors ligne. Le bucket public d’avatars reste public ; ses fichiers existants ne sont pas effacés. La suppression de comptes et la gestion des droits Admin ne sont pas implémentées.

Appliquer database/account-security.sql une seule fois, après les scripts existants, d’abord sur TEST. Après toute réinstallation d’une ancienne définition de RPC, réappliquer la garde de compte actif ; les migrations ultérieures doivent la préserver. database/account-security-test.sql vérifie les refus RLS/RPC en transaction annulée sur le compte fixture dédié.

Les avis Supabase restent les avertissements préexistants concernant les RPC SECURITY DEFINER exposées (gardées ici) et la protection contre les mots de passe compromis désactivée. Références : https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable ; https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

Les métriques Kanban (temps de cycle, débit et cumul des statuts) nécessitent un historique horodaté de transitions, absent aujourd’hui. Ne pas les déduire des dates d’échéance.

Références : https://www.atlassian.com/agile/project-management/kanban-metrics/ ; https://www.atlassian.com/trust/centralized-administration ; https://support.atlassian.com/security-and-access-policies/docs/monitor-and-audit-activity-in-your-organization/
