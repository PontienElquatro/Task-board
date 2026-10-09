# Isolation des environnements Ma’at

`npm run build`, `start`, `watch`, `test` et `test:ci` génèrent la configuration publique avant Angular.
Ne pas utiliser directement `ng build` : passer par les scripts npm.

| Exécution | Projet Supabase |
| --- | --- |
| Vercel, VERCEL=1 et VERCEL_ENV=production | MyTaskBoard (nzdfuhozeiexvtrryndk) |
| Vercel Preview / Development | Maat-test (fuvbwupoilkkawqhhdns) |
| Local, même avec NODE_ENV=production | Maat-test |

Une valeur VERCEL_ENV inconnue ou absente sur Vercel bloque la génération.
Les clés utilisées sont uniquement publiques/publishable : aucune service_role.
Le fichier généré est ignoré par Git. Les comptes et données de test sont indépendants
de ceux de production ; il faut un compte de test pour utiliser une preview.

## Publication et vérification

1. Pousser les changements sur codex/cloud-admin (sans fusionner main).
2. Vérifier que task-board-v1 utilise `npm run build` et expose les variables système Vercel.
3. Attendre une nouvelle preview. Les anciennes previews ne changent pas rétroactivement.
4. Vérifier dans le bundle et dans les requêtes réseau de la nouvelle preview que seul
   fuvbwupoilkkawqhhdns.supabase.co est utilisé, jamais nzdfuhozeiexvtrryndk.supabase.co.
5. Tester la connexion avec un compte de test ; aucune donnée réelle ne doit être copiée.

Aucune migration, configuration Auth distante, fusion main ou promotion de production
n'est effectuée par ces scripts. Les previews historiques restent à traiter séparément.

Tests de sélection : `npm run test:config`.
