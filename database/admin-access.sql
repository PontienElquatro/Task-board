-- Principal and delegated roles. TEST-first rollout with endpoint integration.
-- Authority is UUID-based; the allowlist is a compatibility protection mirror.
create table if not exists maat_private.admin_members (
  user_id uuid primary key references auth.users(id) on delete restrict,
  permissions text[] not null,
  version integer not null default 1 check (version > 0),
  changed_at timestamptz not null default now(),
  check (cardinality(permissions) > 0 and permissions <@ array[
    'overview','users_read','users_manage','teams_read','audit_read','settings_read','settings_manage']::text[])
);
create table if not exists maat_private.admin_control (
  singleton boolean primary key default true check(singleton),
  principal_id uuid not null references maat_private.admin_members(user_id) on delete restrict,
  successor_id uuid references maat_private.admin_members(user_id) on delete restrict,
  transfer_expires_at timestamptz,
  version integer not null default 1,
  check ((successor_id is null) = (transfer_expires_at is null)),
  check (successor_id is null or successor_id <> principal_id)
);
create table if not exists maat_private.admin_access_events (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  target_id uuid,
  action text not null,
  reason text not null,
  created_at timestamptz not null default now()
);
alter table maat_private.admin_members enable row level security;
alter table maat_private.admin_control enable row level security;
alter table maat_private.admin_access_events enable row level security;
revoke all on maat_private.admin_members, maat_private.admin_control, maat_private.admin_access_events from public, anon, authenticated;

do $$
declare principal uuid;
begin
  select principal_id into principal from maat_private.admin_control where singleton;
  if principal is null then
    select id into principal from auth.users where lower(email)='quatrosus@gmail.com' and email_confirmed_at is not null;
    if principal is null then raise exception 'Confirmed initial principal missing'; end if;
  end if;
  insert into maat_private.admin_members(user_id,permissions)
  select u.id,array['overview','users_read','users_manage','teams_read','audit_read','settings_read','settings_manage']::text[]
  from auth.users u join public.taskboard_admin_allowlist a on a.email=lower(u.email)
  where u.email_confirmed_at is not null on conflict(user_id) do nothing;
  insert into maat_private.admin_control(singleton,principal_id) values(true,principal) on conflict(singleton) do nothing;
end;
$$;

create or replace function maat_private.admin_access(actor uuid, session uuid, operation text,
  target uuid default null, requested_permissions text[] default null,
  expected_version integer default null, action_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  control maat_private.admin_control%rowtype;
  member maat_private.admin_members%rowtype;
  existing maat_private.admin_members%rowtype;
  fresh boolean;
  target_email text;
  all_permissions constant text[] := array['overview','users_read','users_manage','teams_read','audit_read','settings_read','settings_manage'];
begin
  -- Serialize role/transfer writes. Never remove the principal between checks.
  select * into control from maat_private.admin_control where singleton for update;
  select * into member from maat_private.admin_members where user_id=actor;
  if member.user_id is null or not exists(select 1 from auth.users u where u.id=actor and u.email_confirmed_at is not null)
    or exists(select 1 from public.taskboard_account_status s where s.user_id=actor and s.suspended)
    or exists(select 1 from public.taskboard_account_deletions d where d.user_id=actor and d.status='processing') then
    raise exception 'Administrator required' using errcode='42501';
  end if;
  select s.created_at > now()-interval '10 minutes' into fresh from auth.sessions s
  where s.id=session and s.user_id=actor and (s.not_after is null or s.not_after>now());
  if fresh is null then raise exception 'Live session required' using errcode='42501'; end if;
  if operation='identity' then
    return jsonb_build_object('isAdmin',true,'isPrincipal',actor=control.principal_id,
      'permissions',case when actor=control.principal_id then all_permissions else member.permissions end,
      'fresh',fresh,'version',control.version,'pendingTransferTo',control.successor_id,
      'transferExpiresAt',control.transfer_expires_at,'canAcceptTransfer',actor=control.successor_id and control.transfer_expires_at>now());
  end if;
  if operation='directory' then
    if actor<>control.principal_id then raise exception 'Principal required' using errcode='42501'; end if;
    return jsonb_build_object('members',coalesce((select jsonb_agg(jsonb_build_object(
      'id',m.user_id,'email',u.email,'permissions',m.permissions,'version',m.version,
      'principal',m.user_id=control.principal_id) order by u.email)
      from maat_private.admin_members m join auth.users u on u.id=m.user_id),'[]'::jsonb),
      'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc,e.id desc)
        from (select id,actor_id,target_id,action,reason,created_at from maat_private.admin_access_events order by created_at desc,id desc limit 50) e),'[]'::jsonb));
  end if;
  if not fresh then raise exception 'Recent sign-in required' using errcode='PT401'; end if;
  if char_length(btrim(coalesce(action_reason,''))) not between 10 and 500 then
    raise exception 'Reason required' using errcode='22023';
  end if;
  if operation='transfer_accept' then
    if actor is distinct from control.successor_id or control.transfer_expires_at<=now() or expected_version is distinct from control.version then
      raise exception 'Transfer unavailable' using errcode='PT409'; end if;
    update maat_private.admin_control set principal_id=actor,successor_id=null,transfer_expires_at=null,version=version+1 where singleton;
    update maat_private.admin_members set permissions=all_permissions,version=version+1,changed_at=now() where user_id=actor;
    target:=actor;
  else
    if actor<>control.principal_id then raise exception 'Principal required' using errcode='42501'; end if;
    if operation in ('transfer_request','transfer_cancel') then
      if expected_version is distinct from control.version then raise exception 'Changed transfer' using errcode='PT409'; end if;
      if operation='transfer_cancel' then
        target:=control.successor_id;
        update maat_private.admin_control set successor_id=null,transfer_expires_at=null,version=version+1 where singleton;
      else
        if target=actor or not exists(select 1 from maat_private.admin_members where user_id=target) then
          raise exception 'Eligible administrator required' using errcode='22023'; end if;
        select email into target_email from auth.users where id=target and email_confirmed_at is not null;
        if target_email is null or exists(select 1 from public.taskboard_account_status where user_id=target and suspended)
          or exists(select 1 from public.taskboard_account_deletions where user_id=target and status in ('pending','processing')) then
          raise exception 'Eligible account required' using errcode='42501'; end if;
        update maat_private.admin_control set successor_id=target,transfer_expires_at=now()+interval '24 hours',version=version+1 where singleton;
      end if;
    elsif operation in ('grant','revoke') then
      if target is null or target=control.principal_id or target=control.successor_id then
        raise exception 'Protected administrator' using errcode='42501'; end if;
      select * into existing from maat_private.admin_members where user_id=target;
      if expected_version is distinct from existing.version then raise exception 'Changed role' using errcode='PT409'; end if;
      -- Auth lock coordinates with the existing deferred-deletion reservation.
      select email into target_email from auth.users where id=target and email_confirmed_at is not null for update;
      if target_email is null then raise exception 'Confirmed account required' using errcode='22023'; end if;
      if operation='revoke' then
        delete from maat_private.admin_members where user_id=target;
        delete from public.taskboard_admin_allowlist where email=lower(target_email);
      else
        if requested_permissions is null or cardinality(requested_permissions)=0 or not requested_permissions<@all_permissions
          or array_position(requested_permissions,null) is not null then
          raise exception 'Invalid permissions' using errcode='22023'; end if;
        if exists(select 1 from public.taskboard_account_status where user_id=target and suspended)
          or exists(select 1 from public.taskboard_account_deletions where user_id=target and status in ('pending','processing')) then
          raise exception 'Eligible account required' using errcode='42501'; end if;
        if 'users_manage'=any(requested_permissions) and not 'users_read'=any(requested_permissions) then requested_permissions:=array_append(requested_permissions,'users_read'); end if;
        if 'settings_manage'=any(requested_permissions) and not 'settings_read'=any(requested_permissions) then requested_permissions:=array_append(requested_permissions,'settings_read'); end if;
        insert into maat_private.admin_members(user_id,permissions) values(target,requested_permissions)
        on conflict(user_id) do update set permissions=excluded.permissions,version=admin_members.version+1,changed_at=now();
        insert into public.taskboard_admin_allowlist(email) values(lower(target_email)) on conflict(email) do nothing;
      end if;
    else raise exception 'Invalid operation' using errcode='22023';
    end if;
  end if;
  insert into maat_private.admin_access_events(actor_id,target_id,action,reason) values(actor,target,operation,btrim(action_reason));
  return jsonb_build_object('success',true);
end;
$$;
revoke all on function maat_private.admin_access(uuid,uuid,text,uuid,text[],integer,text) from public,anon,authenticated;
grant execute on function maat_private.admin_access(uuid,uuid,text,uuid,text[],integer,text) to service_role;
create or replace function public.taskboard_admin_access(actor uuid, session uuid, operation text,
  target uuid default null, requested_permissions text[] default null,
  expected_version integer default null, action_reason text default null)
returns jsonb language sql security invoker set search_path='' as $$
  select maat_private.admin_access(actor,session,operation,target,requested_permissions,expected_version,action_reason);
$$;
revoke all on function public.taskboard_admin_access(uuid,uuid,text,uuid,text[],integer,text) from public,anon,authenticated;
grant execute on function public.taskboard_admin_access(uuid,uuid,text,uuid,text[],integer,text) to service_role;

-- Keep legacy deletion/moderation protection current when an admin changes email.
create or replace function maat_private.admin_email_protection()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from maat_private.admin_members where user_id=new.id) then
    delete from public.taskboard_admin_allowlist where email=lower(old.email);
    if new.email is null then raise exception 'Administrator email required'; end if;
    insert into public.taskboard_admin_allowlist(email) values(lower(new.email)) on conflict(email) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function maat_private.admin_email_protection() from public,anon,authenticated;
drop trigger if exists maat_admin_email_protection on auth.users;
create trigger maat_admin_email_protection after update of email on auth.users for each row
when (old.email is distinct from new.email) execute function maat_private.admin_email_protection();
