# Notifications enrichies et temps réel

Migration : database/enriched-realtime-notifications.sql, après les migrations de notifications et de profils.
Appliquée uniquement à Maat-test. Production non modifiée.

Les nouvelles alertes conservent un instantané du nom et de l'avatar de l'auteur ainsi que du titre du projet. Les anciennes restent lisibles sans ces informations. La fonction interne n'est pas exécutable par les clients ; les métadonnées ne servent jamais à autoriser une action.

Le composant écoute INSERT et UPDATE filtrés par destinataire. Les politiques RLS restent actives. Seul read_at est modifiable par authenticated. Le canal est supprimé à la déconnexion ou à la destruction du composant ; les réponses d'un ancien compte ou d'une requête dépassée sont ignorées.

Un rafraîchissement à l'abonnement évite de perdre les événements pendant la connexion. Le rafraîchissement toutes les 60 secondes et à l'ouverture reste disponible en secours. Le badge compte les alertes non lues parmi les 50 dernières, pas l'historique complet.

Vérifications backend effectuées dans une transaction annulée : nom/projet calculés côté serveur malgré des valeurs falsifiées, publication Realtime, droits UPDATE limités à read_at, fonction interne inaccessible. Aucun nouvel avertissement de sécurité ; les avertissements préexistants restent à traiter :
https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Après build et push, vérifier avec deux comptes :
1. Garder la cloche du destinataire fermée, lui assigner une tâche : le badge doit changer sans actualisation.
2. Ouvrir l'alerte : nom, avatar ou initiales et projet doivent apparaître.
3. Terminer la tâche et une sous-tâche : l'auteur de l'assignation reçoit les alertes sans actualiser.
4. Cliquer l'alerte : bonne tâche, statut lu et badge mis à jour.
5. Déconnecter un compte : aucune alerte de celui-ci ne reste affichée.

Le parcours navigateur du nouveau code reste à valider après déploiement. Aucun email supplémentaire n'est envoyé.
