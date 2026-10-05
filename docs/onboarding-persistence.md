# Guide de première visite

- La première ouverture du guide sur le tableau enregistre maat_guide_seen dans les métadonnées Supabase Auth du compte.
- Le guide reste ouvert pendant cette visite, jusqu’à ce qu’il soit ignoré ou terminé.
- Il ne réapparaît pas à la connexion suivante ou sur un autre appareil une fois la sauvegarde confirmée.
- Les anciennes préférences locales de masquage sont reprises et enregistrées dans le compte.
- La page Aide affiche toujours le guide et ne marque pas, à elle seule, une première visite.
- Cette préférence est uniquement visuelle : elle ne décide d’aucun rôle ou accès.
- Si l’enregistrement échoue, un message avec « Réessayer » apparaît. Le masquage local ne garantit pas le masquage sur un autre appareil.

Vérification : tests Node de la décision de visibilité et compilation Angular/TypeScript. Les tests Jasmine de cycle de session sont ajoutés ; leur exécution dans Chrome et le parcours réel de déconnexion/reconnexion restent à vérifier après déploiement.

Pas de migration SQL nécessaire : utilisation de la mise à jour des [métadonnées utilisateur Supabase](https://supabase.com/docs/reference/javascript/auth-updateuser).
