begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
alter table maat_private.account_deletion_config add column if not exists execution_enabled boolean not null default false;
-- Generate the secret entirely on the server. Do not return it to a client/log.
do $$begin
 if not exists(select 1 from vault.secrets where name='maat_account_deletion_worker') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'maat_account_deletion_worker');
 end if;
end $$;
create or replace function maat_private.verify_deletion_worker(token text)
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('authorized',coalesce(length(token)=64 and exists(
  select 1 from vault.decrypted_secrets where name='maat_account_deletion_worker' and decrypted_secret=token),false),
  'enabled',coalesce((select execution_enabled from maat_private.account_deletion_config where singleton),false));
$$;
revoke all on function maat_private.verify_deletion_worker(text) from public,anon,authenticated;
grant execute on function maat_private.verify_deletion_worker(text) to service_role;
create or replace function public.taskboard_verify_deletion_worker(token text)
returns jsonb language sql security invoker set search_path='' as $$select maat_private.verify_deletion_worker(token);$$;
revoke all on function public.taskboard_verify_deletion_worker(text) from public,anon,authenticated;
grant execute on function public.taskboard_verify_deletion_worker(text) to service_role;

create or replace function maat_private.invoke_deletion_worker()
returns bigint language plpgsql security definer set search_path='' as $$
declare request_id bigint;
begin
 if not exists(select 1 from maat_private.account_deletion_config where singleton and execution_enabled) then return null;end if;
 select net.http_post(
  url:='https://fuvbwupoilkkawqhhdns.supabase.co/functions/v1/account-deletion-worker',
  headers:=jsonb_build_object('Content-Type','application/json','x-worker-secret',
   (select decrypted_secret from vault.decrypted_secrets where name='maat_account_deletion_worker')),
  body:='{"batchSize":10}'::jsonb,timeout_milliseconds:=120000
 ) into request_id;
 return request_id;
end $$;
revoke all on function maat_private.invoke_deletion_worker() from public,anon,authenticated,service_role;
select cron.schedule('maat-account-deletion','*/15 * * * *','select maat_private.invoke_deletion_worker();');
-- Keep the job paused until disposable account, UI and deployment checks pass.
select cron.alter_job(job_id:=(select jobid from cron.job where jobname='maat-account-deletion'),active:=false);
commit;
