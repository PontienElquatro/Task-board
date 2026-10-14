# Corrections après contrôle du déploiement

Contrôle réalisé sur le déploiement rf6r5656e, en local puis connecté : cartes communes, palettes, formulaire personnel, détails/création d’équipe, rôles et avatars. Aucun changement de tâche ou de rôle connecté effectué.

Corrections locales à déployer :

- Directive de blocage du défilement sur les fenêtres personnelles, partagées et projets personnels. Styles restaurés à la destruction, support des fenêtres imbriquées et aucune modification côté serveur.
- Recherche calendrier sur une ligne entière en mobile.
- Avatar « ? » lorsque le nom n’est pas renseigné ; liste de membres avec « Profil à compléter » et instruction vers les paramètres. Aucune identité déduite de l’adresse email.

Validation : compilation Angular, compilation des specs et 24 tests Node de non-régression. Les nouvelles specs de verrouillage sont ajoutées et compilées, mais leur exécution Karma reste à faire. Le rendu de ces corrections n’a pas encore été validé en navigateur : le lien inspecté contient la version précédente.
