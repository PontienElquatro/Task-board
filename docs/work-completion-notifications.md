# Notifications de clôture

Migration appliquée à Maat-test uniquement. Production inchangée.

L’auteur de chaque nouvelle assignation est enregistré dans assigned_by, contrôlé par un déclencheur qui ignore les valeurs fournies par le client. Une clôture de tâche ou sous-tâche notifie cet auteur s’il appartient toujours à l’équipe, sinon le propriétaire. Les anciennes assignations n’ayant pas d’auteur enregistré utilisent également le propriétaire.

Aucune notification à l’acteur lui-même. Une écriture répétant l’état terminé ne produit rien. Une réouverture puis une nouvelle clôture constituent un nouvel événement et peuvent notifier à nouveau. Les sous-tâches renvoient à la tâche parente dans le tableau.

Les notifications sont internes à l’application, pas des emails. La cloche se recharge à son ouverture, par le bouton actualiser et toutes les 60 secondes. Les règles d’accès existantes limitent la lecture au destinataire membre de l’équipe.

Tests exécutés avec rollback : clôture tâche/sous-tâche, doublons, auto-notification, protection assigned_by, anciennes assignations. Contrôle RLS sous rôle authenticated et absence de droit d’exécution des fonctions internes. Aucun scénario d’écriture sur les tâches du navigateur connecté n’a été réalisé.

Les fonctions privilégiées restent dans le schéma privé et non appelables par les clients. Les conseillers signalent toujours les huit anciens RPC publics SECURITY DEFINER et la protection des mots de passe compromis désactivée ; aucune nouvelle alerte liée aux déclencheurs.

Remédiations : https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable et https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
