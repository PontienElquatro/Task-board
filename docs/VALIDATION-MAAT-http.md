# Validation HTTP — Ma’at

## Résultat du 3 octobre 2026

36 contrôles HTTP réussis lors de deux exécutions complètes contre le projet gratuit Maat-test (`fuvbwupoilkkawqhhdns`). Deux comptes fictifs avec de vrais jetons Auth. Production inchangée ; aucun push, déploiement ni achat.

La suite couvre : connexion et vérification serveur des utilisateurs, mot de passe incorrect, JWT invalides/falsifiés, accès anonymes, créations CAS, isolation des lectures/écritures entre comptes, refus des INSERT/UPDATE/DELETE/UPSERT directs, tables admin privées, ancien endpoint désactivé, données invalides, révisions périmées et refresh de session. Deux sauvegardes HTTP concurrentes produisent exactement un succès 200/révision 2 et un conflit 409/PT409 ; la bonne révision est conservée. Les deux déconnexions globales renvoient 204.

## Cause et correction

Le conflit métier utilisait SQLSTATE `40001`. Les journaux ont montré plus de 100 000 répétitions sur certains backends. La documentation Supabase confirme une boucle de retry en PostgREST 14 : [diagnostic officiel](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).

Le code métier a été remplacé par `PT409`, qui renvoie un conflit HTTP 409 sans déclencher cette boucle. Correction appliquée uniquement à la fonction privée de Maat-test, puis arrêt ciblé des trois connexions de test identifiées par leurs PID dans les journaux. Les anciennes données résiduelles ont été nettoyées avant les deux exécutions réussies.

Les sources SQL et tests ont été alignés. Le frontend reconnaît PT409 tout en restant compatible avec 40001 et conserve le brouillon en attente. Un test unitaire supplémentaire couvre ce comportement. Le guide Supabase a conduit à conserver la fonction privée et son propriétaire limité, sans ouvrir les permissions pour contourner le problème.

## Vérifications complémentaires

- Suite SQL de sécurité réussie : 19 refus attendus et assertions de visibilité/révision, transaction annulée.
- 68 tests Angular réussis via `tools/karma-sandbox.cjs`, configuration locale optionnelle adaptée aux restrictions Windows.
- Vérification TypeScript de l’application (`tsc --noEmit -p tsconfig.app.json`) réussie.
- Permissions revérifiées : propriétaire privé maat_workspace_writer sans BYPASSRLS, UPDATE direct refusé à authenticated, RPC refusée à anon.
- Advisor sécurité : pas de problème signalé sur tables/fonctions ; avertissement existant sur la [protection contre les mots de passe divulgués](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Aucun changement payant.
- Build de production réussi dans le terminal utilisateur, d’après la sortie fournie : 36,573 secondes, bundle initial 599,70 kB. L’avertissement de budget (500 kB) n’est pas bloquant. Le lancement dans l’environnement de l’agent reste limité par les permissions Windows.

## Nettoyage vérifié

Zéro workspace de fixture, zéro session, zéro refresh token et zéro mot de passe actif. Seules les données des deux comptes fictifs ont été supprimées ; les tests peuvent les recréer. Les identités demeurent pour les tests SQL. Aucun mot de passe ou jeton écrit dans le dépôt ni affiché dans les résultats. Les JWT déjà émis peuvent rester valides jusqu’à expiration ; le script n’en conserve aucune copie.

## Reproduction et limites

`npm run test:cloud-http` appelle `tools/test-cloud-http.mjs`, qui refuse tout projet autre que Maat-test et exige une publishable key. Variables requises : `MAAT_TEST_PUBLIC_KEY` et `MAAT_TEST_PASSWORD`. Préparer les deux fixtures avec un mot de passe temporaire et leurs workspaces vides ; nettoyer ensuite côté serveur et désactiver les identifiants, même en cas d’échec. Ne jamais utiliser de comptes réels.

Ces tests ne valident pas l’envoi d’emails, le parcours UI complet ou les fonctions Edge admin. Les rapports des lots précédents sont historiques ; le présent rapport remplace le statut HTTP partiel initial. Le correctif n’a pas encore été appliqué en production.
