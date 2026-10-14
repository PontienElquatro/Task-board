# Emails Ma’at — préférences et file préparées, envois non activés

## Implémenté localement

- Modèle d’invitation HTML responsive à tables, sans image externe ni pixel de suivi ; palette bleu/indigo, bouton et lien de secours, expiration UTC, rôles français, signature « Ma’at by El_Quatro Technology ».
- Version texte alternative ; noms d’équipe échappés dans le HTML et retours à la ligne supprimés de l’objet.
- Modèle d’attribution générique, sans titre, description ou identité de membre dans l’aperçu email. Il n’est encore appelé par aucun worker.
- Le handler d’invitation utilise le nouveau modèle sans modifier ses contrôles de session, droits, invitation et origines autorisées.
- Tests locaux sans appel réseau, inclus dans la CI.
- Choix `email_assignments` séparé des deux préférences de cloche, `false` par défaut. L’interface permet d’enregistrer le choix et indique explicitement que le service est en préparation.
- File `maat_private.notification_email_outbox` à accès refusé pour les clients et `service_role`, RLS sans politique ouverte, sans adresse email ni contenu de tâche stockés.
- Révision d’attribution générée par la base : une modification sans réattribution conserve la révision ; une nouvelle attribution crée un nouvel événement. Unicité `(event_version,user_id)` ; les clients ne peuvent pas forger la révision.
- Les réattributions et la désactivation du choix email annulent les événements en attente. Supprimer le travail supprime sa file via les clés étrangères.
- Interrupteur `maat_private.notification_email_config.enabled=false`, non modifiable par les clients ni `service_role`. Tant qu’il reste désactivé, aucune attribution n’alimente la file. Aucun rattrapage des anciennes attributions à l’activation.

## Configuration à confirmer

`pontienmisenga93@gmail.com` est l’adresse publique de contact confirmée. Elle peut devenir une adresse de réponse, mais n’est pas une adresse expéditeur sur un domaine contrôlé par le projet. Ne pas la configurer comme expéditeur Resend.

L’utilisateur a confirmé ne posséder actuellement que Gmail, sans domaine expéditeur. L’expéditeur existant `Ma’at <onboarding@resend.dev>` reste inchangé pour le handler d’invitation. Aucun secret, déploiement Edge Function ou envoi réel n’a été effectué. Le script de structure a été appliqué à **Maat-test uniquement**, production inchangée. Pour activer les emails applicatifs, confirmer une adresse sur un domaine vérifié dans Resend, puis configurer les secrets côté serveur uniquement. Ne jamais partager ni versionner la clé Resend.

`database/notification-email-outbox.sql` est un script de préparation à exécuter une seule fois sur une base ayant déjà les préférences de cloche. Il n’est pas un fichier de migration CLI et n’est pas inscrit dans l’historique Supabase : le CLI n’est pas disponible dans cet environnement. Avant une promotion, générer et vérifier la migration avec le CLI selon le processus du projet, et appliquer la structure avant le frontend. Ne pas rejouer les anciens scripts de préférences.

## Étapes restantes avant activation

1. Vérifier le parcours connecté des préférences sur un aperçu après push. La suite navigateur et le build locaux sont validés. Une invitation explicitement demandée reste distincte d’une notification d’attribution.
2. Ajouter les RPC réservées au worker, un bail de traitement et les délais de reprise. Ne pas accorder un accès direct à la file aux clients.
3. Revérifier compte actif, adresse confirmée, appartenance à l’équipe, attribution **et révision** courantes et préférence avant l’envoi. Supprimer les événements devenus obsolètes. La validation à la création de l’événement ne remplace pas la validation avant envoi.
4. Ajouter un worker désactivé par défaut, authentifié, avec délais d’appel et reprises bornées. Persister le résultat sans exposer de contenu ou de clé dans les logs. Tester deux workers simultanés et les résultats incertains avant d’activer quoi que ce soit.
5. Obtenir un domaine expéditeur, vérifier sur le backend de test et demander l’autorisation d’un envoi à un destinataire précis avant toute activation réelle. Production inchangée. Ne pas activer l’interrupteur SQL seul.

La clé d’idempotence Resend existante pour une invitation est conservée. Resend conserve ces clés pendant **24 heures seulement** : ce n’est pas une déduplication durable. La future file devra éviter les réémissions automatiques après une réponse incertaine hors de cette fenêtre ; ne pas prétendre garantir un envoi unique avec cette seule clé.

Sources : [Supabase — Sending Emails](https://supabase.com/docs/guides/functions/examples/send-emails), [Resend — Idempotency Keys](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Vérification

```sh
node --test tools/notification-email.test.mjs
node tools/test-team-invitation-edge.mjs
```

Les tests valident le rendu, les variantes texte, les liens HTTPS, les rôles, l’expiration, l’absence d’injection HTML, les permissions et les erreurs fournisseur simulées. Ils ne prouvent pas la livraison en boîte mail ni le rendu dans tous les clients email.

## Résultats du 14 octobre 2026

- 6 tests des modèles email et régression du handler d’invitation : réussis sans réseau.
- TypeScript des tests et compilation Angular des templates (`ngc --noEmit`) : réussis dans la copie isolée.
- `database/test-notification-email-outbox.sql` : réussi sur Maat-test, tous les changements de test annulés. Vérifie interrupteur, opt-in indépendant de la cloche, déduplication, réattribution, opt-out, destinataire suspendu, suppression du travail et isolation des comptes.
- Ancien test `database/test-notification-preferences.sql` : réussi ; cloche et progression du travail préservées.
- État final relu : interrupteur `false`, file vide, zéro utilisateur activé par ces tests.
- Suite Vitest navigateur exécutée dans le terminal utilisateur : **182 tests réussis, 35 fichiers**, dont les 7 tests du composant de préférences. Le lancement par l’agent était bloqué par un refus d’accès avant les tests.
- Build `dist/email-preferences-check` et contrôle des styles : réussis. Bundle initial 742,74 kB (178,63 kB estimés au transfert), avertissement existant de dépassement du budget de 500 kB conservé. Ces vérifications ne prouvent pas encore le parcours connecté sur l’aperçu ni la livraison email.
- Conseillers Supabase : les nouvelles tables privées signalent [RLS sans politique](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), intentionnel pour refuser tout accès client. Pas de permission ouverte ajoutée pour supprimer cet avis. L’avertissement existant [protection des mots de passe compromis désactivée](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) reste hors de ce bloc. Les avertissements de performance préexistants restent inchangés ; les nouveaux index encore inutilisés sont conservés pour la future file.
