begin;
-- Only service-role RPCs can supply a reservation token. No secrets or email in logs.
create table if not exists maat_private.account_deletion_events (
 id bigint generated always as identity primary key,
 user_id uuid not null, happened_at timestamptz not null default now(),
 outcome text not null check(outcome in ('retry','deleted'))
);
alter table maat_private.account_deletion_events enable row level security;
revoke all on maat_private.account_deletion_events from public,anon,authenticated;
grant select on maat_private.account_deletion_events to service_role;
create policy deletion_events_service on maat_private.account_deletion_events for select to service_role using(true);

create or replace function maat_private.deletion_step(account uuid, token uuid, operation text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.taskboard_account_deletions%rowtype; account_email text; objects jsonb;
begin
 select lower(email) into account_email from auth.users where id=account for update;
 if not found then return jsonb_build_object('deleted',true);end if;
 select * into item from public.taskboard_account_deletions d where d.user_id=account for update;
 if item.status is distinct from 'processing' or token is null or item.claim_token is distinct from token then
  raise exception 'Invalid reservation' using errcode='42501';
 end if;
 if operation='retry' then
  update public.taskboard_account_deletions set claim_token=null,retry_after=now()+interval '15 minutes' where user_id=account;
  insert into maat_private.account_deletion_events(user_id,outcome) values(account,'retry');
  return '{}'::jsonb;
 end if;
 if exists(select 1 from public.taskboard_teams where owner_id=account)
 or exists(select 1 from public.taskboard_admin_allowlist where email=account_email)
 then raise exception 'Protected account' using errcode='42501';end if;
 if operation='objects' then
  select coalesce(jsonb_agg(jsonb_build_object('bucket',o.bucket_id,'name',o.name)),'[]'::jsonb) into objects
  from (select bucket_id,name from storage.objects
   where bucket_id<>'team-task-documents'
    and (owner_id=account::text or owner=account or (bucket_id='avatars' and split_part(name,'/',1)=account::text))
   order by bucket_id,name limit 100) o;
  return objects;
 elsif operation='check' then return '{}'::jsonb;
 else raise exception 'Invalid operation' using errcode='22023';end if;
end $$;
revoke all on function maat_private.deletion_step(uuid,uuid,text) from public,anon,authenticated;
grant execute on function maat_private.deletion_step(uuid,uuid,text) to service_role;
create or replace function public.taskboard_deletion_step(account uuid,token uuid,operation text)
returns jsonb language sql security invoker set search_path='' as $$select maat_private.deletion_step(account,token,operation);$$;
revoke all on function public.taskboard_deletion_step(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.taskboard_deletion_step(uuid,uuid,text) to service_role;

-- Shared tasks survive: their membership FKs clear assignee_id when the user is
-- removed, while assigned_by uses its auth.users FK with ON DELETE SET NULL.
create or replace function maat_private.guard_deletion()
returns trigger language plpgsql security definer set search_path='' as $$
declare item public.taskboard_account_deletions%rowtype;
begin
 select * into item from public.taskboard_account_deletions where user_id=old.id;
 if item.status='processing' then
  lock table public.taskboard_admin_allowlist in share mode;
  if item.claim_token is null or exists(select 1 from public.taskboard_teams where owner_id=old.id)
  or exists(select 1 from public.taskboard_admin_allowlist where email=lower(old.email))
  or exists(select 1 from storage.objects where bucket_id<>'team-task-documents'
   and (owner_id=old.id::text or owner=old.id or (bucket_id='avatars' and split_part(name,'/',1)=old.id::text))) then
   raise exception 'Account cleanup incomplete or protected' using errcode='42501';
  end if;
  insert into maat_private.account_deletion_events(user_id,outcome) values(old.id,'deleted');
 end if;
 return old;
end $$;
revoke all on function maat_private.guard_deletion() from public,anon,authenticated;
drop trigger if exists maat_guard_account_deletion on auth.users;
create trigger maat_guard_account_deletion before delete on auth.users for each row execute function maat_private.guard_deletion();

-- A team transfer uses the same auth.users lock as claims/deletion. A transfer
-- that starts first commits before claim; a later transfer is rejected.
create or replace function maat_private.guard_processing_owner()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from auth.users where id=new.owner_id for key share;
 if exists(select 1 from public.taskboard_account_deletions where user_id=new.owner_id and status='processing') then
  raise exception 'Account is being deleted' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function maat_private.guard_processing_owner() from public,anon,authenticated;
drop trigger if exists maat_guard_processing_owner on public.taskboard_teams;
create trigger maat_guard_processing_owner before insert or update of owner_id on public.taskboard_teams
 for each row execute function maat_private.guard_processing_owner();

create or replace function maat_private.guard_processing_admin()
returns trigger language plpgsql security definer set search_path='' as $$
declare account uuid;
begin
 select id into account from auth.users where lower(email)=new.email for key share;
 if exists(select 1 from public.taskboard_account_deletions where user_id=account and status='processing') then
  raise exception 'Account is being deleted' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function maat_private.guard_processing_admin() from public,anon,authenticated;
drop trigger if exists maat_guard_processing_admin on public.taskboard_admin_allowlist;
create trigger maat_guard_processing_admin before insert or update of email on public.taskboard_admin_allowlist
 for each row execute function maat_private.guard_processing_admin();
commit;
