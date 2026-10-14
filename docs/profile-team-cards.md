# Profils et cartes — 5 octobre 2026

Prénom et nom sont obligatoires à l’inscription et modifiables dans les paramètres. Les anciens noms sont conservés tant que l’utilisateur ne renseigne pas ces champs. Les noms contenant une adresse email sont remplacés par « Membre » dans les équipes, sans déduire une identité de l’adresse.

Le composant avatar utilise la photo HTTPS du profil, puis les initiales si elle est absente ou inaccessible. Il est utilisé pour les membres, les responsables des tâches et des sous-tâches partagées. Les cartes personnelles et partagées utilisent le même composant : titre lisible sans texte barré, actions secondaires discrètes, progression uniquement avec des sous-tâches, échéance et responsable dans le pied de carte. Les palettes personnalisées et permissions sont conservées.

## Base

`database/team-profiles.sql` a été appliqué uniquement à Maat-test (`fuvbwupoilkkawqhhdns`). La production n’a pas été modifiée. Le nouveau RPC public est SECURITY INVOKER ; la lecture de auth.users est encapsulée dans une fonction privée avec contrôle d’appartenance. Aucune adresse email n’est exposée par ce RPC. Le frontend utilise l’ancien roster si le nouveau RPC est absent.

Vérifications transactionnelles avec rollback : membres autorisés, absence de données d’autres équipes, nom/photo propagés, utilisateur extérieur sans résultat, session absente sans résultat et exécution anonyme interdite. Les métadonnées de profil ne servent jamais à accorder des droits.

## Validation

- Compilation Angular sans émission et compilation TypeScript des tests réussies.
- 18 tests Node réussis, dont les nouveaux tests de noms et initiales.
- Scénario navigateur mis à jour pour le nouveau RPC, mais non exécuté. Le build complet reste bloqué dans cet environnement par un accès refusé dans esbuild ; rendu responsive et interactions visuelles à valider après un build local.
- Aucun nouvel avertissement de sécurité lié au RPC. Les avertissements préexistants concernant huit autres RPC publics SECURITY DEFINER et la protection contre les mots de passe compromis restent hors de cette livraison.

Références de remédiation : https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable et https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
