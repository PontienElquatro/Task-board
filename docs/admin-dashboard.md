# Console Ma’at

La console admin supervise les comptes et l’adoption. Les tableaux des projets restent les espaces de travail Kanban des équipes.

## Fonctions disponibles

- Vue d’ensemble : comptes, espaces cloud, équipes et projets partagés.
- Adoption : confirmations et connexions sur 30 jours sur tous les comptes. L’annuaire est récupéré intégralement côté serveur puis projeté en champs sûrs ; recherche, tri et pagination de 50 comptes opèrent sur cet annuaire complet.
- Utilisateurs : recherche par email/ID, filtres par rôle/confirmation/synchronisation, tri, pagination, fiche et copie d’identifiant.
- Collaboration : compteurs globaux des invitations acceptées, en attente et expirées. Une invitation annulée est supprimée et ne figure pas dans ces totaux.
- Journal : historique paginé par 30 consultations, recherche et export CSV de la page filtrée affichée. Les contrôles de rôle et la navigation vers les anciennes pages n’écrivent pas une nouvelle consultation.
- Paramètres : accès au profil et au mot de passe de l’administrateur.

## Accès aux données

La fonction Edge vérifie la session, la confirmation email et la liste d’administrateurs à chaque appel. La fonction SQL d’agrégation est SECURITY INVOKER et exécutable uniquement par service_role. Elle ne retourne ni titres de projets, ni tâches, ni emails d’invitation, ni jetons. Les noms des comptes ne sont pas ajoutés à la projection existante : les avatars utilisent les initiales de l’email.

## Suite du produit

Limites explicites : la récupération complète de l’annuaire est adaptée à la taille actuelle et plafonnée à 10 000 comptes (erreur explicite au-delà, jamais de chiffres partiels). À cette échelle, remplacer le chargement complet par un index administratif paginé côté serveur. La pagination du journal par décalage peut se déplacer en cas de nouvelles consultations concurrentes. Les compteurs ne remplacent pas une supervision technique ; celle-ci et l’audit des mutations sont des fonctionnalités futures.

Vérification locale : tools/test-admin-edge.mjs simule 1 051 comptes sur deux lots et la deuxième page du journal. tools/test-admin-ui.mjs vérifie trois pages sur 125 comptes, la recherche globale et l’échappement CSV (guillemets et formules). La réception du téléchargement dans le navigateur reste à vérifier sur le nouveau frontend déployé.

La suspension, suppression de compte et gestion des droits depuis la console ne sont pas implémentées. Elles exigent une gestion complète des sessions, des protections contre le retrait du dernier administrateur et un audit des mutations.

Les métriques Kanban (temps de cycle, débit et cumul des statuts) nécessitent un historique horodaté de transitions, absent aujourd’hui. Ne pas les déduire des dates d’échéance.

Références : https://www.atlassian.com/agile/project-management/kanban-metrics/ ; https://www.atlassian.com/trust/centralized-administration ; https://support.atlassian.com/security-and-access-policies/docs/monitor-and-audit-activity-in-your-organization/
