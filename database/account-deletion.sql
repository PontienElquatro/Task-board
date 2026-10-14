-- Foundation only: requests remain disabled until the purge worker is validated.
begin;
create table maat_private.account_deletion_config (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false
);
insert into maat_private.account_deletion_config(singleton) values(true);
revoke all on maat_private.account_deletion_config from public,anon,authenticated;
grant select,update on maat_private.account_deletion_config to service_role;
create table public.taskboard_account_deletions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 requested_at timestamptz not null default now(),
 delete_after timestamptz not null,
 status text not null check(status in ('pending','cancelled','processing')),
 cancelled_at timestamptz,
 check(delete_after=requested_at+interval '720 hours')
);
alter table public.taskboard_account_deletions enable row level security;
revoke all on public.taskboard_account_deletions from public,anon,authenticated;
grant select on public.taskboard_account_deletions to authenticated;
grant all on public.taskboard_account_deletions to service_role;
create policy deletion_read_self on public.taskboard_account_deletions for select to authenticated
 using(user_id=(select auth.uid()));
create index deletion_due_idx on public.taskboard_account_deletions(delete_after) where status='pending';

create function maat_private.manage_account_deletion(operation text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare account uuid:=auth.uid(); account_email text; item public.taskboard_account_deletions%rowtype; enabled boolean;
begin
 if account is null then raise exception 'Connexion requise' using errcode='42501';end if;
 select lower(u.email) into account_email from auth.users u where id=account for update;
 if not found then raise exception 'Compte introuvable' using errcode='42501';end if;
 if operation not in ('status','request','cancel') or operation is null then raise exception 'Action invalide' using errcode='22023';end if;
 select c.enabled into enabled from maat_private.account_deletion_config c where singleton;
 select * into item from public.taskboard_account_deletions where user_id=account for update;
 if operation='request' then
  if not coalesce(enabled,false) then raise exception 'Suppression différée pas encore disponible' using errcode='55000';end if;
  if not public.taskboard_account_active() then raise exception 'Compte indisponible' using errcode='42501';end if;
  if exists(select 1 from public.taskboard_admin_allowlist a where a.email=account_email) then raise exception 'Compte administrateur protégé' using errcode='42501';end if;
  if exists(select 1 from public.taskboard_teams where owner_id=account) then raise exception 'Transférez vos équipes avant de demander la suppression' using errcode='55000';end if;
  if item.status='processing' then raise exception 'Suppression en traitement' using errcode='55000';end if;
  if item.status is distinct from 'pending' then
   insert into public.taskboard_account_deletions(user_id,requested_at,delete_after,status,cancelled_at)
    values(account,now(),now()+interval '720 hours','pending',null)
    on conflict(user_id) do update set requested_at=excluded.requested_at,delete_after=excluded.delete_after,status='pending',cancelled_at=null
    returning * into item;
  end if;
 elsif operation='cancel' and item.status='pending' then
  if now()>=item.delete_after then raise exception 'Délai d’annulation expiré' using errcode='55000';end if;
  update public.taskboard_account_deletions set status='cancelled',cancelled_at=now() where user_id=account returning * into item;
 elsif operation='cancel' and item.status='processing' then
  raise exception 'Suppression en traitement' using errcode='55000';
 end if;
 return jsonb_build_object('enabled',coalesce(enabled,false),'status',item.status,'requestedAt',item.requested_at,'deleteAfter',item.delete_after);
end $$;
revoke all on function maat_private.manage_account_deletion(text) from public,anon,authenticated;
grant usage on schema maat_private to authenticated;
grant execute on function maat_private.manage_account_deletion(text) to authenticated;
create function public.taskboard_manage_account_deletion(operation text)
returns jsonb language sql security invoker set search_path='' as $$
 select maat_private.manage_account_deletion(operation);
$$;
revoke all on function public.taskboard_manage_account_deletion(text) from public,anon,authenticated;
grant execute on function public.taskboard_manage_account_deletion(text) to authenticated;
commit;
