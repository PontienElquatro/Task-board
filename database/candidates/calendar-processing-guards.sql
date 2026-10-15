-- Local candidate only: no purge worker, email worker or administrator bootstrap.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
alter table public.taskboard_shared_tasks
  add column start_date date,
  add column end_date date,
  add constraint shared_tasks_schedule_order
    check(start_date is null or end_date is null or end_date >= start_date);

create function maat_private.guard_processing_owner()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from auth.users where id=new.owner_id for key share;
  if exists(select 1 from public.taskboard_account_deletions
    where user_id=new.owner_id and status='processing') then
    raise exception 'Account is being deleted' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function maat_private.guard_processing_owner() from public,anon,authenticated,service_role;
create trigger maat_guard_processing_owner before insert or update of owner_id
  on public.taskboard_teams for each row execute function maat_private.guard_processing_owner();

create function maat_private.guard_processing_admin()
returns trigger language plpgsql security definer set search_path='' as $$
declare account uuid;
begin
  select id into account from auth.users where lower(email)=new.email for key share;
  if exists(select 1 from public.taskboard_account_deletions
    where user_id=account and status='processing') then
    raise exception 'Account is being deleted' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function maat_private.guard_processing_admin() from public,anon,authenticated,service_role;
create trigger maat_guard_processing_admin before insert or update of email
  on public.taskboard_admin_allowlist for each row execute function maat_private.guard_processing_admin();
commit;
