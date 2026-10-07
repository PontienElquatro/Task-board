# Livraison UI/UX Ma’at

Chaque bloc doit être validé explicitement avant de commencer le suivant.

## Bloc 1 — en cours

Premier lot : présentation commune des champs de connexion, tâches personnelles,
tâches partagées et administration ; indication accessible des champs invalides ;
messages de titre obligatoire ; verrouillage du défilement des modales admin.
La logique de validation et les permissions restent inchangées.

À terminer : champs des paramètres, projets et calendrier ; harmonisation des
boutons et états vides ; vérification complète mobile, sombre, clavier et contraste.
Le test UiField est ajouté et compilé, mais son exécution navigateur reste à faire.
La compilation Angular seule ne constitue pas une validation visuelle.

Critères de sortie : parcours de création/modification sans perte de saisie,
dialogues au clavier et retour du focus, absence de débordement horizontal mobile,
états invalides et désactivés lisibles, erreurs persistantes et succès temporaires.

## Bloc 2 — non commencé

Paramètres du compte Standard. Ne pas commencer sans validation du bloc 1.
