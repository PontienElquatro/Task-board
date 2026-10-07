# Livraison UI/UX Ma’at

Chaque bloc doit être validé explicitement avant de commencer le suivant.

## Bloc 1 — en cours

Premier lot : présentation commune des champs de connexion, tâches personnelles,
tâches partagées et administration ; indication accessible des champs invalides ;
messages de titre obligatoire ; verrouillage du défilement des modales admin.
La logique de validation et les permissions restent inchangées.

Deuxième lot : champs communs étendus aux paramètres, équipes, projets et calendrier.
Les changements de mode de connexion réinitialisent les états touched/dirty/submitted
sans perdre l’email. Les erreurs redeviennent visibles après interaction.

Troisième lot : en-têtes avec variantes sombres explicites et déconnexion compacte
(icône accessible, cible 44 × 44 px, traitement neutre et rouge au survol).
La logique de déconnexion reste inchangée. Validation visuelle après déploiement.

Quatrième lot : sélecteur de thème dans le header global ; états vides du tableau
avec hiérarchie des actions et focus visibles ; recherche de projets réinitialisable ;
actions du formulaire de projet adaptées au mobile et libellés création/modification.
Ces changements restent à valider visuellement sur le prochain déploiement.

Cinquième lot : états vides des projets partagés selon le rôle, accès connexion/équipes,
messages distincts par colonne et par filtres ; retour au tableau depuis les archives ;
actions de création de tâches personnelles/partagées adaptées au mobile.
Les états vides ne masquent pas un chargement ou une erreur de projets partagés.
Validation visuelle sur déploiement encore requise.

Contrôles live qx9h3dsvn : déconnexion 44 × 44 px avec infobulle ; archives et retour ;
validation titre de tâche partagée, Échap et retour du focus ; recherche sans résultat.
À 390 × 844 : liste des projets sans débordement de page, modale projet et retour
du focus vérifiés sans sauvegarde. Le header sur deux lignes a été compacté en masquant
le nom de marque sur mobile uniquement (logo et nom accessible conservés).
Cette correction doit être vérifiée sur le prochain déploiement.
Accès /admin refusé au compte standard ; contrôles admin connecté encore requis.

À terminer : harmonisation des autres boutons et états vides ; vérification complète
mobile, sombre, clavier et contraste ; validation des formulaires personnels/équipe.
Le test UiField est ajouté et compilé, mais son exécution navigateur reste à faire.
La compilation Angular seule ne constitue pas une validation visuelle.

Critères de sortie : parcours de création/modification sans perte de saisie,
dialogues au clavier et retour du focus, absence de débordement horizontal mobile,
états invalides et désactivés lisibles, erreurs persistantes et succès temporaires.

## Bloc 2 — non commencé

Paramètres du compte Standard. Ne pas commencer sans validation du bloc 1.
