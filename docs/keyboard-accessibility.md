# Clavier et accessibilité — validation progressive

## Corrections

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

- Compte standard : Tab/Maj+Tab, menu de compte et cloche avec Échap, navigation équipe et paramètres, focus visible en clair et sombre à 390 et 1440 px.
- Compte principal : ouverture/fermeture des fiches admin et d’équipe, retour du focus, formulaires en consultation seulement. Ne pas modifier les rôles, suspensions, mots de passe ou demandes de suppression pour tester le clavier.
- Connexion : labels, ordre de focus et erreurs ; ne pas déclencher d’email de récupération sans nouvel accord explicite.
- Lecteur d’écran et contrastes : contrôles manuels complémentaires. Cette vérification ciblée ne constitue pas une certification WCAG ni une couverture de tous les dialogues et états de l’application.

La mise en production et l’attribution de `maat.vercel.app` restent reportées. Les notifications email restent désactivées.
