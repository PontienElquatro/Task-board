# Suppression du compte à 30 jours

Le délai est calculé côté serveur : 720 heures. Le compte reste accessible
pendant ce délai, une demande répétée ne repousse pas l'échéance et l'annulation
est possible strictement avant celle-ci. Les comptes suspendus, administrateurs
protégés et propriétaires d'équipes ne peuvent pas demander la suppression.

## Livraison sur Maat-test

Les migrations account-deletion.sql, account-deletion-security.sql,
account-deletion-worker.sql, account-deletion-cleanup.sql et
account-deletion-scheduler.sql sont appliquées sur Maat-test.
Le worker account-deletion-worker est déployé. Le job maat-account-deletion
est créé toutes les 15 minutes, en pause. enabled et execution_enabled restent
false pendant la validation finale. La production n'est pas modifiée.

Le secret est généré dans Supabase Vault. Le worker vérifie x-worker-secret via
une RPC réservée au service_role ; aucun secret n'est placé dans le frontend.
Un appel réel avec le secret valide renvoie 200/disabled, un mauvais secret 401.

## Comportement et protections

Le parcours Sécurité recommande l'export, explique les conséquences et exige
la case de confirmation et SUPPRIMER. getUser confirme l'identité côté Auth,
mais ne demande pas un nouveau mot de passe.

La réservation verrouille auth.users puis la demande et attribue un jeton
exclusif. Aucun autre worker ne reprend une réservation active, même après
15 minutes. Chaque étape vérifie son jeton et les protections propriétaire/admin.
Les transferts de propriété et promotions admin vers un compte en traitement
sont refusés. Un trigger revérifie ces protections lors de la suppression Auth
et la refuse si des objets Storage restent présents.

Le worker bloque les nouvelles connexions, énumère les objets appartenant au
compte dans tous les buckets (ainsi que son dossier avatars), les supprime par
l'API Storage en lots de 100, puis supprime Auth. Les FK suppriment l'espace
personnel et les sessions. Les tâches partagées restent dans l'équipe :
les FK d'appartenance remettent assignee_id à null, assigned_by devient null.
Le contrôle d'existence et de statut refuse les anciennes JWT.

Une erreur connue libère le jeton avec une attente de 15 minutes. Les autres
comptes continuent. Le journal privé enregistre retry/deleted sans email ni
secret. Un arrêt brutal conserve la réservation : la reprise exige que
l'opérateur confirme la fin du worker avant de libérer le jeton.

## Vérifications

Les tests SQL avec rollback couvrent demande, annulation, expiration,
exclusivité, reprise, mauvais jeton, refus propriétaire/admin, cascade et JWT
obsolète. Le test de cycle crée puis supprime uniquement un compte temporaire
dans sa transaction ; aucune modification ne persiste.

tools/test-account-deletion-edge.mjs teste le worker avec des API simulées.
Le cycle réel Auth/Storage a également été validé sur Maat-test : un compte
jetable et son avatar ont été créés par API, traités par cleanupAccount puis
contrôlés absents. Réponse HTTP 200 : authDeleted=true, storageDeleted=true.
La branche temporaire de test est retirée après l'essai. Le compte et l'avatar
de test sont supprimés définitivement ; aucun compte existant n'est supprimé.
La validation visuelle du déploiement frontend reste nécessaire avant activation.

## Activation après validation

```sql
begin;
update maat_private.account_deletion_config
set enabled=true,execution_enabled=true where singleton;
select cron.alter_job(job_id:=(select jobid from cron.job
where jobname='maat-account-deletion'),active:=true);
commit;
```

Pour arrêter les prochaines exécutions et nouvelles demandes, remettre les
deux options à false et le job à active=false. Un worker déjà lancé peut finir
son lot ; ne jamais libérer sa réservation pendant son exécution.

## Activation sur Maat-test — 11 octobre 2026

Demandes, worker et cron toutes les 15 minutes activés sur Maat-test uniquement.
Sept tests Angular passent ; build Vercel READY ; affichages mobile et ordinateur
et confirmations vérifiés. Demande, délai exact de 720 heures et annulation
testés sur un compte jetable transactionnel. Worker activé : HTTP 200, mode
executed, aucun échec. File vide à la validation, aucun compte existant programmé.
Production inchangée. Le test de fondation désactive les demandes uniquement
dans sa transaction annulée pour rester utilisable après activation. Aperçu :
https://task-board-v1-5krf3ndau-pontien-misengas-projects.vercel.app/settings

## Suivi et récupération

```sql
select user_id,attempts,retry_after,claim_token is not null as reserved
from public.taskboard_account_deletions where status='processing';
select user_id,happened_at,outcome from maat_private.account_deletion_events
order by happened_at desc limit 100;
select status,return_message,start_time,end_time from cron.job_run_details
where jobid=(select jobid from cron.job where jobname='maat-account-deletion')
order by start_time desc limit 20;
select status_code,error_msg,created from net._http_response
order by created desc limit 20;
```

Après arrêt brutal confirmé, cibler un seul user_id vérifié puis mettre
claim_token à null et retry_after à now(). Ne pas remettre le statut à pending :
le nettoyage peut être partiellement effectué et le compte doit rester bloqué.
La reprise recommence les étapes idempotentes.

Documentation :
https://supabase.com/docs/guides/auth/managing-user-data
https://supabase.com/docs/guides/functions/schedule-functions
https://supabase.com/docs/guides/cron/quickstart
