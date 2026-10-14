# Clavier et accessibilité — validation progressive

## Corrections

- Ajustement demandé après la validation : hamburger des actions du compte déplacé à l’extrémité droite, après l’avatar, dans l’ordre DOM et visuel. L’ouverture place le focus dans les actions après rendu ; Échap restitue le focus au hamburger. Un test de position et de parcours est ajouté au script navigateur.
- Validation reçue le 15 octobre 2026 pour cet ajustement : **188 tests réussis dans 35 fichiers**, build `dist/header-final-check` réussi et trois parcours clavier réussis (1440 px clair, 390 px clair/sombre), y compris position du hamburger et retour du focus. Bundle initial 743,73 kB, transfert estimé 178,89 kB ; avertissement de dépassement du budget de 500 kB conservé. Aucun déploiement de production validé par ces tests locaux.

- Le lien « Aller au contenu » déplace réellement le focus au `main`, sans ajouter ce contenu à l’ordre Tab (`tabindex=-1`). Pas d’interception tant que le contenu n’est pas disponible.
- Le hamburger visiteurs place le focus sur le premier lien après rendu, seulement si le menu est encore ouvert et le lien visible. Échap ferme le menu et rend le focus au bouton.
- Une tentative de fermeture d’une tâche modifiée place le focus sur « Continuer l’édition », au lieu de laisser une confirmation hors du parcours clavier.
- Échap dans cette confirmation revient à l’édition sans abandonner la saisie. Un événement Échap déjà traité par un contrôle enfant n’entraîne pas une fermeture supplémentaire.

## Contrôles locaux

`tools/test-keyboard-browser.mjs` sert un vrai build de production local dans des contextes éphémères. Toutes les requêtes externes et WebSockets sont bloqués ; aucun compte, email ni donnée partagée n’est utilisé. Le brouillon de tâche est remis à vide et fermé sans enregistrement.

Parcours à 1440 px clair, 390 px clair et 390 px sombre, avec réduction des animations : lien d’évitement, hamburger (mobile), focus initial de la tâche, confirmation d’abandon, retour à l’édition, 30 Tab et 30 Maj+Tab dans le dialogue, fermeture et restitution du focus, débordement horizontal, erreurs JavaScript.

```sh
npm run test:ci
npm run build -- --output-path dist/keyboard-check
node tools/check-built-styles.mjs dist/keyboard-check/browser
node tools/test-public-pages-browser.mjs dist/keyboard-check/browser
node tools/test-keyboard-browser.mjs dist/keyboard-check/browser
```

Le nouveau test est aussi inclus dans la CI après le build. Captures locales : `tmp/keyboard-visual` (non versionnées).

Le 14 octobre 2026 : compilation TypeScript des tests, compilation Angular des templates sans émission et syntaxe du script navigateur réussies. Le terminal utilisateur confirme **187 tests réussis dans 35 fichiers**, le build et le contrôle des styles. Les quatre parcours visiteurs passent à 1440 px clair, 390 px clair/sombre et 320 px clair.

Le premier test clavier lisait le nombre de boutons immédiatement après Échap, avant le rendu Angular. Le script attend maintenant que la confirmation soit retirée du DOM (sans délai arbitraire). Réexécution locale par l’agent sur le même build `dist/keyboard-check/browser` : **trois parcours clavier réussis**, 1440 px clair et 390 px clair/sombre. Aucun compte ni appel externe.

Bundle initial : 743,26 kB (178,81 kB estimés au transfert). L’avertissement de dépassement du budget de 500 kB reste présent ; il n’a pas été masqué.

## Contrôles connectés encore requis

### Observation connectée du 14 octobre 2026

Aperçu du commit `25d61f6` : `https://task-board-v1-830mehej8-pontien-misengas-projects.vercel.app`, fenêtre observée 700 × 524 px. Session affichant « Pontien Misenga » et « Sauvegarde cloud confirmée ». Le nom affiché ne prouve pas l’identité du compte principal.

- Menu du compte ouvert avec Entrée, fermé avec Échap : retour du focus au bouton du compte confirmé par l’arbre d’accessibilité.
- Cloche ouverte avec Entrée puis fermée avec Échap, sans consulter les liens de notification ni modifier leur état de lecture.
- Navigation mobile ouverte avec Entrée ; lien Paramètres activé au clavier et menu refermé après navigation.
- Section Notifications accessible avec Espace. Préférences chargées, choix email décoché, boutons d’enregistrement/annulation désactivés faute de changement. Aucun choix enregistré.
- Lien « Aller au contenu » activé avec Entrée dans les paramètres : focus sur `main-content` confirmé ; pas de débordement horizontal du document à cette largeur.
- Page Équipe : TheDev et ses membres visibles en consultation ; aucune invitation, création d’équipe ou modification de rôle.
- Route `/admin` : page « Accès administrateur indisponible », précisant droits absents **ou** vérification momentanément indisponible. Les fiches administrateur ne sont donc pas validées sur cette session. Il faut confirmer le compte principal puis, si nécessaire, diagnostiquer la vérification ; ne pas attribuer de droits pour débloquer un test.

Ces observations ne valident pas les vues connectées à 390/1440 px, les contrastes, un lecteur d’écran ou tous les dialogues. L’attachement initial au navigateur a subi un délai important ; aucune donnée utilisateur n’a été modifiée pendant ce délai.

### Complément après connexion administrateur

Après la confirmation utilisateur « connecté sur admin », la console est accessible avec une session affichant « Admin Adm ». Le refus précédent ne décrit plus cette session ; aucune modification de droit n’a été effectuée pour obtenir cet accès.

- Section Collaboration ouverte avec Espace. Fiche TheDev ouverte avec Entrée : focus initial sur Fermer, Tab/Maj+Tab maintenus dans la fiche, Échap ferme la fiche et rend le focus au bouton TheDev.
- Section Utilisateurs ouverte avec Espace. Fiche du compte principal ouverte avec Entrée : focus initial sur Fermer la fiche ; Maj+Tab atteint le dernier contrôle de la fiche sans sortir du dialogue ; Échap restitue le focus au bouton Voir la fiche de la même ligne.
- Fiche utilisateur réouverte à **390 × 844** puis **1440 × 1000** : focus dans le dialogue, fermeture avec Échap et restitution au bouton de départ. Aucun débordement horizontal du document mesuré aux deux dimensions ; la fiche mobile reste dans la largeur du viewport.
- Les dimensions temporaires du navigateur ont été réinitialisées après les contrôles. Aucune suspension, modification de rôle, copie d’identifiant, invitation, export ou modification de préférence.

Ces parcours connectés ont été vérifiés en thème clair. Le mode sombre connecté, les autres fenêtres, les lecteurs d’écran et les contrastes restent à contrôler ; ne pas extrapoler les résultats des trois parcours locaux à toute l’administration.

- Compte standard : Tab/Maj+Tab, menu de compte et cloche avec Échap, navigation équipe et paramètres, focus visible en clair et sombre à 390 et 1440 px.
- Compte principal : ouverture/fermeture des fiches admin et d’équipe, retour du focus, formulaires en consultation seulement. Ne pas modifier les rôles, suspensions, mots de passe ou demandes de suppression pour tester le clavier.
- Connexion : labels, ordre de focus et erreurs ; ne pas déclencher d’email de récupération sans nouvel accord explicite.
- Lecteur d’écran et contrastes : contrôles manuels complémentaires. Cette vérification ciblée ne constitue pas une certification WCAG ni une couverture de tous les dialogues et états de l’application.

La mise en production et l’attribution de `maat.vercel.app` restent reportées. Les notifications email restent désactivées.
