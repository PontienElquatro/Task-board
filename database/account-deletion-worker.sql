-- Worker foundation only. This claims due requests; it never deletes an account.
-- Apply only after reviewing the worker and its scheduler configuration.
alter table public.taskboard_account_deletions
 add column if not exists retry_after timestamptz,
 add column if not exists attempts integer not null default 0;
alter table public.taskboard_account_deletions add column if not exists claim_token uuid;
create or replace function maat_private.claim_account_deletions(batch_size integer default 10)
returns table(user_id uuid, email text, requested_at timestamptz, delete_after timestamptz)
language plpgsql security definer set search_path='' as $$
declare
 candidate record;
 item public.taskboard_account_deletions%rowtype;
 limit_count integer:=least(greatest(coalesce(batch_size,10),1),50);
begin
 for candidate in
  select u.id,u.email
  from auth.users u
  where exists (
   select 1 from public.taskboard_account_deletions d
   where d.user_id=u.id and d.status in ('pending','processing') and d.delete_after<=now()
   and (d.retry_after is null or d.retry_after<=now())
   and d.claim_token is null
  )
  order by u.id
  limit limit_count
  for update of u skip locked
 loop
  select * into item
  from public.taskboard_account_deletions d
  where d.user_id=candidate.id and d.status in ('pending','processing') and d.delete_after<=now()
  and (d.retry_after is null or d.retry_after<=now())
  and d.claim_token is null
  for update skip locked;
  if not found then continue; end if;
  if exists(select 1 from public.taskboard_admin_allowlist a where a.email=lower(candidate.email))
     or exists(select 1 from public.taskboard_teams t where t.owner_id=candidate.id) then
   continue;
  end if;
  update public.taskboard_account_deletions as d
  set status='processing',retry_after=now()+interval '15 minutes',attempts=d.attempts+1,claim_token=gen_random_uuid()
  where d.user_id=candidate.id
  returning d.* into item;
  if found then
   user_id:=candidate.id; email:=candidate.email; requested_at:=item.requested_at; delete_after:=item.delete_after;
   return next;
  end if;
 end loop;
end $$;
revoke all on function maat_private.claim_account_deletions(integer) from public,anon,authenticated;
grant execute on function maat_private.claim_account_deletions(integer) to service_role;
grant usage on schema maat_private to service_role;

create or replace function public.taskboard_claim_account_deletions(batch_size integer default 10)
returns table(user_id uuid, email text, requested_at timestamptz, delete_after timestamptz)
language sql security invoker set search_path='' as $$
 select * from maat_private.claim_account_deletions(batch_size);
$$;
revoke all on function public.taskboard_claim_account_deletions(integer) from public,anon,authenticated;
grant execute on function public.taskboard_claim_account_deletions(integer) to service_role;

create or replace function public.taskboard_claim_account_deletions_v2(batch_size integer default 10)
returns table(user_id uuid, claim_token uuid)
language plpgsql security invoker set search_path='' as $$
declare c record;
begin
 for c in select * from maat_private.claim_account_deletions(batch_size) loop
  return query select d.user_id,d.claim_token from public.taskboard_account_deletions d where d.user_id=c.user_id;
 end loop;
end;
$$;
revoke all on function public.taskboard_claim_account_deletions_v2(integer) from public,anon,authenticated;
grant execute on function public.taskboard_claim_account_deletions_v2(integer) to service_role;
