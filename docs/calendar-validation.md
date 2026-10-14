# Calendrier Ma’at

## Fonctionnement

- Les tâches personnelles actives et les tâches des équipes accessibles figurent dans les vues mois, semaine et agenda.
- Une période inclut ses deux dates. Une tâche ayant une seule date apparaît ce jour-là ; une tâche sans date figure dans « À planifier ».
- La fin prévue est inclusive : une tâche non terminée devient en retard le lendemain, selon la date locale. Les dates ne changent jamais son statut.
- Filtres : texte, espace, projet, statut, responsable d’équipe et tâches terminées.
- Les lecteurs consultent les dates. Propriétaires, administrateurs et membres peuvent les modifier ; les politiques RLS existantes restent appliquées.
- Les dates d’équipe peuvent être définies dans les formulaires de création, les détails et le calendrier. Les cartes partagées affichent l’échéance et le retard.
- Le bouton d’actualisation recharge les équipes ; aucune synchronisation temps réel spécifique au calendrier n’est annoncée.

## Déploiement

Le script database/calendar-scheduling.sql est appliqué à Maat-test. La production n’a pas été modifiée. Appliquer la migration à tout autre environnement avant d’y déployer cette version.

## Vérifications effectuées

- Compilation Angular et compilation TypeScript des tests.
- Tests Node sur les périodes inclusives, les limites de mois/année, les dates facultatives, les dates inversées, les retards et l’adaptateur des cartes partagées.
- Transaction SQL annulée après vérification : dates persistées, statut inchangé, dates inversées refusées.
- Transaction SQL annulée : le rôle lecteur ne peut pas modifier les tâches de son équipe.
- Les avertissements Supabase existants sont toujours présents ; aucune nouvelle fonction privilégiée ou politique n’est ajoutée.
  Références : [fonctions SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) et [protection des mots de passe](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Vérifications restantes après déploiement

- Build complet : bloqué ici par un refus d’accès Windows aux dossiers parents.
- Contrôle visuel réel sur mobile et en mode sombre.
- Avec deux comptes : modifier une date comme propriétaire puis consulter comme lecteur, vérifier les filtres et le lien vers la tâche.
