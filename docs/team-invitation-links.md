# Invitations par lien privé

Depuis Équipe, renseigner l’adresse du destinataire et son rôle, puis choisir
« Créer le lien d’invitation ». Aucun email automatique n’est envoyé.
Copier le lien complet et le transmettre en privé au destinataire.

Le champ est en lecture seule et sélectionnable pour permettre la copie manuelle
si le presse-papiers est indisponible. L’avertissement explique de ne pas modifier
le lien, car il contient le code nécessaire à l’acceptation, et de se connecter
avec l’adresse invitée. La date d’expiration est affichée.

Le secret est placé dans le fragment `#` de l’URL. Il n’est pas envoyé dans la
requête HTTP d’ouverture de page. Il reste sensible, notamment dans le
presse-papiers et l’historique du navigateur. Les anciens liens avec paramètres
de requête restent acceptés pour compatibilité.

Le destinataire déconnecté doit se connecter avec l’adresse invitée, puis rouvrir
le lien original. L’acceptation utilise la RPC existante, qui vérifie le code,
le destinataire, l’expiration et l’état de l’invitation côté serveur. Après
acceptation, la navigation revient à `/team` sans le secret.

Le lien créé reste uniquement dans l’état de la page : pas de stockage local,
pas de journal, pas de secret ajouté à l’historique des invitations affiché.
Il est effacé à l’annulation, au changement de compte ou en quittant la page.
Un lien perdu doit être remplacé en annulant l’invitation et en la recréant.

Cette modification frontend ne nécessite aucune migration ni fonction email.
La compilation locale utilise la configuration backend locale ; un déploiement
doit sélectionner explicitement la configuration de production habituelle.

## Validation du 19 octobre 2026

- Vérification TypeScript de tous les fichiers de test : réussie.
- Quatre suites ciblées dans Chrome sans fenêtre : 22 tests réussis.
- Build de production Angular 21 : réussi, avec l’avertissement de budget
  initial (745,24 ko pour une cible de 500 ko).
- Lecture seule de la RPC de production et de son implémentation privée :
  contrôles du destinataire confirmé, du code, de l’expiration et des droits
  de l’émetteur présents. Aucune invitation réelle créée pour ces contrôles.

Les validations Angular ont utilisé `tmp/invitation-validation-54EXhe`, avec les
dépendances Angular 21 déjà disponibles dans le dossier de vérification sécurité.
Le `node_modules` principal pointe encore vers un autre projet en Angular 20.
Pour les tests, `CHROME_BIN` a été réglé sur Chrome installé, car le Chromium
attendu par Playwright n’est pas présent. Aucun changement de configuration de
test versionnée n’a été nécessaire. La fonctionnalité n’était pas encore publiée
à l’issue de cette validation.

## Publication du 21 octobre 2026

Après reconnexion Vercel du propriétaire, déploiement production READY
`dpl_2VpEc9bQ2RPZ1wQobmPYPtt253eK`, puis promotion réussie sur
`https://task-board-v1.vercel.app`.

Source isolée : `tmp/production-frontend-h7Z3qe`, export du commit
`388705e3113fd588c10a687f6bcb56ac9c70f540` avec uniquement les sept fichiers
des invitations ajoutés ou remplacés. Les autres modifications locales ne sont
pas incluses. Les sources des invitations restent à versionner : la connexion
GitHub intégrée a refusé la création d’un arbre Git (403) ; aucun commit distant
n’a été créé pour cette publication CLI.

Le build distant confirme le backend de production. Les routes `/home` et
`/team` répondent HTTP 200. Les 35 fichiers JavaScript du manifeste ont été lus :
bouton de copie, avertissement de partage intégral et backend de production
présents. L’alias public pointe vers ce même déploiement. Aucune invitation
réelle ni email envoyé pour ces vérifications.
