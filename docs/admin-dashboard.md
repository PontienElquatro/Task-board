# Console Ma’at

La console admin supervise les comptes et l’adoption. Les tableaux des projets restent les espaces de travail Kanban des équipes.

## Fonctions disponibles

- Vue d’ensemble : comptes, espaces cloud, équipes et projets partagés.
- Adoption : confirmations et connexions sur 30 jours de la page utilisateurs courante (50 comptes maximum). Ces chiffres ne sont pas présentés comme des totaux globaux.
- Utilisateurs : recherche par email/ID, filtres par rôle/confirmation/synchronisation, tri, pagination, fiche et copie d’identifiant.
- Collaboration : compteurs globaux des invitations acceptées, en attente et expirées. Une invitation annulée est supprimée et ne figure pas dans ces totaux.
- Journal : 30 dernières consultations autorisées, recherche et export CSV du résultat filtré. Les contrôles de rôle utilisent une action séparée sans écrire de consultation.
- Paramètres : accès au profil et au mot de passe de l’administrateur.

## Accès aux données

La fonction Edge vérifie la session, la confirmation email et la liste d’administrateurs à chaque appel. La fonction SQL d’agrégation est SECURITY INVOKER et exécutable uniquement par service_role. Elle ne retourne ni titres de projets, ni tâches, ni emails d’invitation, ni jetons. Les noms des comptes ne sont pas ajoutés à la projection existante : les avatars utilisent les initiales de l’email.

## Suite du produit

La suspension, suppression de compte et gestion des droits depuis la console ne sont pas implémentées. Elles exigent une gestion complète des sessions, des protections contre le retrait du dernier administrateur et un audit des mutations.

Les métriques Kanban (temps de cycle, débit et cumul des statuts) nécessitent un historique horodaté de transitions, absent aujourd’hui. Ne pas les déduire des dates d’échéance.

Références : https://www.atlassian.com/agile/project-management/kanban-metrics/ ; https://www.atlassian.com/trust/centralized-administration ; https://support.atlassian.com/security-and-access-policies/docs/monitor-and-audit-activity-in-your-organization/
