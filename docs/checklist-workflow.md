# Workflow des sous-tâches

Une modification de checklist applique les règles suivantes :
- Une étape terminée parmi plusieurs : En cours.
- Toutes les étapes terminées, y compris une seule étape : Terminé.
- Une étape rouverte sur une tâche terminée : En cours.
- Toutes les étapes décochées après démarrage : reste En cours.
- Une étape incomplète ajoutée à une tâche terminée : En cours.
- Aucune étape : aucune clôture automatique.

Les changements de titre, description ou responsable et le réordonnancement des étapes ne recalculent pas le statut. La clôture manuelle reste possible même avec des étapes ouvertes. Les statuts historiques ne sont pas recalculés au chargement ni par la migration.

Personnel : src/app/core/subtask-workflow.ts est utilisé par TaskService.updateTask, donc par les cases et le formulaire ; une seule sauvegarde immutable conserve l'annulation et le placement dans la colonne cible.

Équipe : database/checklist-workflow.sql remplace le déclencheur qui démarrait seulement la tâche. Deux déclencheurs privés verrouillent le parent et calculent le statut dans la transaction de modification de la checklist. Le RPC verrouille le parent avant l'étape et revérifie les droits après verrouillage. La clôture automatique utilise les notifications existantes, seulement si le statut change réellement.

Les permissions RLS ne changent pas : un lecteur peut progresser sur une étape assignée à lui, ce qui fait évoluer automatiquement le parent, mais pas modifier directement le parent non assigné ou les étapes d'autrui.

Migration appliquée à Maat-test uniquement. Production non modifiée.

Vérifications réalisées :
- 40 tests Node réussis, dont 8 cas de workflow.
- Compilation Angular et compilation TypeScript des specs réussies.
- database/test-checklist-workflow.sql : transitions, réouverture, édition neutre, notification unique et refus sans connexion.
- database/test-checklist-permissions.sql : tests sous le vrai rôle authenticated, progression du lecteur assigné et refus des autres modifications par RPC et RLS.
- Fixtures SQL entièrement annulées avec ROLLBACK.
- Aucun nouvel avertissement de sécurité ; les alertes préexistantes restent à traiter :
  https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
  https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Les specs Jasmine modifiées ont été compilées, pas exécutées dans Karma. Le test visuel personnel et équipe sur le nouveau déploiement reste à faire après build et push. Utiliser une tâche dédiée avec deux étapes pour observer les trois colonnes, puis rouvrir une étape et vérifier la notification au donneur d'ordre.
