# Publication de Ma’at — contrôle avant promotion

État au 3 octobre 2026 : HTTP Maat-test 36/36, deux exécutions ; Angular 68/68 ; TypeScript validé. Le build de production a réussi dans le terminal utilisateur (sortie fournie : 36,573 secondes, bundle initial 599,70 kB, avertissement non bloquant de 99,70 kB). Aucun correctif de ce lot appliqué à la production.

## 1. Valider le build dans le terminal utilisateur

Le build lancé par l’agent échoue sur les accès aux répertoires parents Windows, même après une autorisation de lecture. Ne pas modifier les ACL du profil ni retirer les contrôles de compilation pour masquer cette erreur.

Dans PowerShell, avec Node 22.12+ ou 24 installé :

```powershell
Set-Location 'C:\Users\DELL\Documents\Codex\2026-09-24\j\work\github-task-board'
node --version
npm run build
```

Une sortie avec code 0 et les fichiers générés dans `dist/my-task-board/browser` sont nécessaires. En cas d’échec, conserver le message exact ; ne pas publier un ancien dossier dist comme preuve de réussite. Le seuil de bundle d’avertissement existant est 500 kB et le seuil d’erreur 1 MB.

## 2. Publier une branche de validation, pas promouvoir directement

Les changements locaux comprennent plusieurs lots non publiés : examiner le diff complet et ne pas inclure `.env`, sessions, mots de passe de test ou sorties compilées. Le workflow `.github/workflows/quality.yml` exécute les tests Angular, admin et le build. Il faut vérifier son résultat sur le commit effectivement publié.

Valider une preview Vercel avant toute fusion ou promotion. La configuration actuelle déclare `dist/my-task-board/browser` et un fallback vers `index.csr.html`. Tester les accès directs aux routes et le rechargement de la page. Une preview frontend n’isole pas automatiquement Supabase : le frontend actuel pointe toujours sur MyTaskBoard. Ne pas y lancer les tests destructifs ou fixtures destinés à Maat-test.

## 3. Séparer frontend et base

Le frontend reconnaît à la fois `40001` (ancien serveur) et `PT409` (serveur corrigé). Le correctif frontend peut donc être vérifié sans changer simultanément les permissions de production.

Le candidat `database/workspaces-cas-hardening.sql` n’est pas une migration à rejouer automatiquement : il crée des rôles, schémas et politiques et a été validé sur Maat-test uniquement. Préparer une migration versionnée et une procédure de restauration avant de modifier la base de production. Ne pas exécuter les fichiers fixtures/security/race contre MyTaskBoard.

## 4. Vérifications finales

- Connexion et déconnexion ; sauvegarde et rechargement sans perte du brouillon.
- Conflit de version retourné rapidement en HTTP 409 ; aucune boucle de retry métier.
- Accès admin refusé à un utilisateur ordinaire et autorisé uniquement aux comptes prévus.
- Routes `/board` et `/admin` accessibles après rechargement direct.
- Aucun passage à un forfait payant ni modification de production sans décision explicite.

Le rapport détaillé est `docs/VALIDATION-MAAT-http.md`. Le parcours email, les fonctions Edge admin réelles et le déploiement de production ne sont pas validés par la suite HTTP de workspace.
