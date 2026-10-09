# Sessions du compte

Paramètres → Sécurité : carte de session actuelle et déconnexion des autres
sessions. Disponible pour le compte standard et le profil administrateur.

L'action utilise `auth.signOut({scope:'others'})`, après confirmation et validation
du compte par `getUser`. Elle ne modifie pas les tâches et conserve la session
actuelle. La déconnexion locale reste dans l'en-tête, avec son contrôle préalable
de sauvegarde cloud. Aucune clé privilégiée ni nouvelle table n'est nécessaire.

Limite explicite : les jetons d'accès existants restent valides jusqu'à expiration.
Révoquer leur renouvellement n'est pas une coupure instantanée de tout accès.
La liste d'appareils, leur localisation et la révocation individuelle ne sont pas
implémentées. Les sessions sont stockées par onglet dans Ma’at, pas partagées entre
tous les onglets du navigateur.

Documentation : https://supabase.com/docs/guides/auth/signout

## Vérification après déploiement

1. Connecter le même compte dans deux sessions distinctes.
2. Annuler la confirmation : aucun appel de révocation.
3. Confirmer dans A : succès, A reste connectée.
4. Dans B, vérifier l'échec du renouvellement après expiration du jeton.
5. Se reconnecter dans B ; vérifier que les données sont conservées.

Ne pas effectuer ce test sur les sessions du propriétaire sans son autorisation.
Le succès de la requête ne prouve pas une déconnexion immédiate de B.
