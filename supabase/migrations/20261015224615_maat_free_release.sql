-- LOCAL ATOMIC CANDIDATE ONLY. No remote execution or administrator bootstrap.
begin;
-- Stage: workspace
-- LOCAL REHEARSAL CANDIDATE ONLY. Not a versioned or approved production migration.
-- Stage 1: CAS hardening. Account suspension/deletion guards are a later stage.

set local lock_timeout='5s';
set local statement_timeout='30s';
do $$begin
  if to_regnamespace('maat_private') is not null
    or exists(select 1 from pg_roles where rolname='maat_workspace_writer') then
    raise exception 'Unexpected baseline: private schema or writer role already exists';
  end if;
  if to_regclass('public.taskboard_workspaces') is null
    or not exists(select 1 from pg_class where oid='public.taskboard_workspaces'::regclass and relrowsecurity)
    or to_regprocedure('public.save_taskboard_workspace_for_user(uuid,bigint,jsonb)') is null then
    raise exception 'Expected production workspace baseline missing';
  end if;
end$$;
create role maat_workspace_writer nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant maat_workspace_writer to postgres;
grant authenticated to maat_workspace_writer;
create schema maat_private;
revoke all on schema maat_private from public,anon,authenticated;
grant usage on schema maat_private to authenticated,maat_workspace_writer;
grant usage on schema public to maat_workspace_writer;
grant execute on function auth.uid() to maat_workspace_writer;
revoke all on public.taskboard_workspaces from public,anon,authenticated;
grant select on public.taskboard_workspaces to authenticated;
grant select,insert,update on public.taskboard_workspaces to maat_workspace_writer;
create policy workspace_writer_read on public.taskboard_workspaces for select to maat_workspace_writer
  using ((select auth.uid())=user_id);
create policy workspace_writer_insert on public.taskboard_workspaces for insert to maat_workspace_writer
  with check ((select auth.uid())=user_id);
create policy workspace_writer_update on public.taskboard_workspaces for update to maat_workspace_writer
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create function maat_private.save_workspace(workspace_user uuid,expected_revision bigint,workspace_data jsonb)
returns bigint language plpgsql security definer set search_path='' as $$
declare result bigint;
begin
  if auth.uid() is null or workspace_user is null or auth.uid() is distinct from workspace_user then
    raise exception 'Account mismatch' using errcode='42501';
  end if;
  if expected_revision is null or expected_revision<0 or expected_revision=9223372036854775807 then
    raise exception 'Invalid revision' using errcode='22023';
  end if;
  if workspace_data is null or jsonb_typeof(workspace_data)<>'object' or octet_length(workspace_data::text)>5242880 then
    raise exception 'Invalid workspace' using errcode='22023';
  end if;
  if expected_revision=0 then
    insert into public.taskboard_workspaces(user_id,data) values(workspace_user,workspace_data)
      on conflict(user_id) do nothing returning revision into result;
  else
    update public.taskboard_workspaces set data=workspace_data,revision=revision+1,updated_at=now()
      where user_id=workspace_user and revision=expected_revision returning revision into result;
  end if;
  if result is null then raise exception 'Workspace changed on another device' using errcode='PT409'; end if;
  return result;
end;
$$;
grant create on schema maat_private to maat_workspace_writer;
alter function maat_private.save_workspace(uuid,bigint,jsonb) owner to maat_workspace_writer;
revoke create on schema maat_private from maat_workspace_writer;
revoke all on function maat_private.save_workspace(uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function maat_private.save_workspace(uuid,bigint,jsonb) to authenticated;
create or replace function public.save_taskboard_workspace_for_user(workspace_user uuid,expected_revision bigint,workspace_data jsonb)
returns bigint language sql security invoker set search_path='' as $$
  select maat_private.save_workspace(workspace_user,expected_revision,workspace_data);
$$;
revoke all on function public.save_taskboard_workspace_for_user(uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.save_taskboard_workspace_for_user(uuid,bigint,jsonb) to authenticated;
revoke all on function public.save_taskboard_workspace(bigint,jsonb) from public,anon,authenticated;


-- Stage: collaboration

-- LOCAL INTERMEDIATE CANDIDATE. Invitations/notifications/account lifecycle not ready.

set local lock_timeout='5s';
set local statement_timeout='30s';
do $$begin
 if to_regnamespace('maat_private') is null
   or to_regclass('public.taskboard_teams') is not null then
   raise exception 'Expected workspace-only rehearsal baseline';
 end if;
end$$;
-- Reviewed source: teams.sql
-- Collaboration Ma'at: teams, members and invitations.
create table if not exists public.taskboard_teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.taskboard_team_members (
  team_id uuid not null references public.taskboard_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.taskboard_team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.taskboard_teams(id) on delete cascade,
  email text not null check (char_length(trim(email)) between 3 and 254),
  role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists taskboard_team_members_user_idx on public.taskboard_team_members(user_id);
create index if not exists taskboard_team_invitations_email_idx on public.taskboard_team_invitations(lower(email));

alter table public.taskboard_teams enable row level security;
alter table public.taskboard_team_members enable row level security;
alter table public.taskboard_team_invitations enable row level security;

revoke all on public.taskboard_teams, public.taskboard_team_members, public.taskboard_team_invitations from anon;
grant select, insert, update, delete on public.taskboard_teams, public.taskboard_team_members, public.taskboard_team_invitations to authenticated;

drop policy if exists teams_read_member on public.taskboard_teams;
drop policy if exists teams_read_owner on public.taskboard_teams;
create policy teams_read_owner on public.taskboard_teams for select to authenticated
using (owner_id = (select auth.uid()));
drop policy if exists teams_create_owner on public.taskboard_teams;
create policy teams_create_owner on public.taskboard_teams for insert to authenticated
with check (owner_id = (select auth.uid()));
drop policy if exists teams_update_owner on public.taskboard_teams;
create policy teams_update_owner on public.taskboard_teams for update to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists teams_delete_owner on public.taskboard_teams;
create policy teams_delete_owner on public.taskboard_teams for delete to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists members_read_member on public.taskboard_team_members;
drop policy if exists members_read_self on public.taskboard_team_members;
create policy members_read_self on public.taskboard_team_members for select to authenticated
using (user_id = (select auth.uid()));
drop policy if exists members_manage_admin on public.taskboard_team_members;
create policy members_manage_admin on public.taskboard_team_members for all to authenticated
using (exists (select 1 from public.taskboard_teams t where t.id = team_id and t.owner_id = (select auth.uid())));

create or replace function public.is_taskboard_team_member(team_uuid uuid)
returns boolean language sql stable security definer set search_path = public, pg_catalog as $$
 select exists(select 1 from public.taskboard_team_members where team_id=team_uuid and user_id=(select auth.uid()));
$$;
revoke all on function public.is_taskboard_team_member(uuid) from public, anon;
grant execute on function public.is_taskboard_team_member(uuid) to authenticated;
drop policy if exists teams_read_owner on public.taskboard_teams;
create policy teams_read_owner on public.taskboard_teams for select to authenticated
using (owner_id=(select auth.uid()) or public.is_taskboard_team_member(id));
drop policy if exists members_read_self on public.taskboard_team_members;
create policy members_read_self on public.taskboard_team_members for select to authenticated
using (user_id=(select auth.uid()) or public.is_taskboard_team_member(team_id));

drop policy if exists invitations_read_admin on public.taskboard_team_invitations;
create policy invitations_read_admin on public.taskboard_team_invitations for select to authenticated
using (invited_by = (select auth.uid()) or exists (select 1 from public.taskboard_teams t where t.id = team_id and t.owner_id = (select auth.uid())));
drop policy if exists invitations_create_admin on public.taskboard_team_invitations;
create policy invitations_create_admin on public.taskboard_team_invitations for insert to authenticated
with check (invited_by = (select auth.uid()) and exists (select 1 from public.taskboard_teams t where t.id = team_id and t.owner_id = (select auth.uid())));
drop policy if exists invitations_update_admin on public.taskboard_team_invitations;
create policy invitations_update_admin on public.taskboard_team_invitations for update to authenticated
using (invited_by = (select auth.uid())) with check (invited_by = (select auth.uid()));

create or replace function public.accept_taskboard_team_invitation(invitation_id uuid, invitation_token text)
returns uuid language plpgsql security definer set search_path = public, pg_catalog as $$
declare invitation public.taskboard_team_invitations%rowtype;
begin
  if auth.uid() is null or auth.email() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into invitation from public.taskboard_team_invitations
    where id = invitation_id and lower(email) = lower(auth.email()) and token_hash = invitation_token
      and accepted_at is null and expires_at > now();
  if not found then raise exception 'Invitation invalid or expired' using errcode = '22023'; end if;
  insert into public.taskboard_team_members(team_id,user_id,role)
    values (invitation.team_id,auth.uid(),invitation.role)
    on conflict (team_id,user_id) do update set role = excluded.role;
  update public.taskboard_team_invitations set accepted_at = now() where id = invitation.id;
  return invitation.team_id;
end;
$$;
revoke all on function public.accept_taskboard_team_invitation(uuid,text) from public, anon;
grant execute on function public.accept_taskboard_team_invitation(uuid,text) to authenticated;

-- Reviewed source: team-management.sql
create or replace function public.taskboard_team_roster()
returns table(team_id uuid,user_id uuid,role text,display_name text)
language sql stable security definer set search_path='' as $$
select m.team_id,m.user_id,m.role,
coalesce(nullif(u.raw_user_meta_data->>'full_name',''),nullif(u.raw_user_meta_data->>'name',''),u.email)
from public.taskboard_team_members m join auth.users u on u.id=m.user_id
where auth.uid() is not null and public.is_taskboard_team_member(m.team_id);
$$;
revoke all on function public.taskboard_team_roster() from public,anon;
grant execute on function public.taskboard_team_roster() to authenticated;
create or replace function public.cancel_taskboard_invitation(invitation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
delete from public.taskboard_team_invitations i using public.taskboard_teams t
where i.id=invitation_id and i.team_id=t.id and t.owner_id=auth.uid() and i.accepted_at is null;
if not found then raise exception 'Annulation impossible : invitation acceptée ou accès refusé.'; end if;
end; $$;
revoke all on function public.cancel_taskboard_invitation(uuid) from public,anon;
grant execute on function public.cancel_taskboard_invitation(uuid) to authenticated;

-- Reviewed source: team-roles.sql
create or replace function public.taskboard_manage_team(tid uuid)
returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null and exists(select 1 from public.taskboard_teams t where t.id=tid and (t.owner_id=auth.uid() or exists(select 1 from public.taskboard_team_members m where m.team_id=t.id and m.user_id=auth.uid() and m.role='admin')));
$$;
revoke all on function public.taskboard_manage_team(uuid) from public,anon;
grant execute on function public.taskboard_manage_team(uuid) to authenticated;
create or replace function public.manage_taskboard_member(tid uuid, member_id uuid, new_role text)
returns void language plpgsql security definer set search_path='' as $$
declare owner_id uuid; target_role text; actor_role text;
begin
select t.owner_id into owner_id from public.taskboard_teams t where t.id=tid for update;
if not found or auth.uid() is null then raise exception 'Accès refusé.'; end if;
select m.role into actor_role from public.taskboard_team_members m where m.team_id=tid and m.user_id=auth.uid();
select m.role into target_role from public.taskboard_team_members m where m.team_id=tid and m.user_id=member_id;
if target_role is null then raise exception 'Membre introuvable.'; end if;
if member_id=owner_id or target_role='owner' then raise exception 'Le propriétaire ne peut pas être modifié ou retiré.'; end if;
if auth.uid()<>owner_id and (actor_role is distinct from 'admin' or target_role='admin' or member_id=auth.uid() or new_role='admin') then raise exception 'Seul le propriétaire peut gérer les administrateurs.'; end if;
if new_role is null then
delete from public.taskboard_team_members where team_id=tid and user_id=member_id;
else
if new_role not in ('admin','member','viewer') then raise exception 'Rôle invalide.'; end if;
update public.taskboard_team_members set role=new_role where team_id=tid and user_id=member_id;
end if;
end; $$;
revoke all on function public.manage_taskboard_member(uuid,uuid,text) from public,anon;
grant execute on function public.manage_taskboard_member(uuid,uuid,text) to authenticated;
revoke update,delete on public.taskboard_team_members from authenticated;
drop policy if exists invitations_read_admin on public.taskboard_team_invitations;
create policy invitations_read_admin on public.taskboard_team_invitations for select to authenticated using(public.taskboard_manage_team(team_id));
drop policy if exists invitations_create_admin on public.taskboard_team_invitations;
create policy invitations_create_admin on public.taskboard_team_invitations for insert to authenticated with check(invited_by=auth.uid() and public.taskboard_manage_team(team_id) and (role<>'admin' or exists(select 1 from public.taskboard_teams t where t.id=team_id and t.owner_id=auth.uid())));
revoke update,delete on public.taskboard_team_invitations from authenticated;
create or replace function public.cancel_taskboard_invitation(invitation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
delete from public.taskboard_team_invitations i where i.id=invitation_id and i.accepted_at is null and public.taskboard_manage_team(i.team_id) and (i.role<>'admin' or exists(select 1 from public.taskboard_teams t where t.id=i.team_id and t.owner_id=auth.uid()));
if not found then raise exception 'Annulation impossible : invitation acceptée ou accès refusé.'; end if;
end; $$;

-- Reviewed source: shared-projects.sql
create or replace function public.taskboard_edit_team(tid uuid)
returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null and exists(select 1 from public.taskboard_team_members where team_id=tid and user_id=auth.uid() and role in ('owner','admin','member'));
$$;
revoke all on function public.taskboard_edit_team(uuid) from public,anon;
grant execute on function public.taskboard_edit_team(uuid) to authenticated;
create table public.taskboard_shared_projects(
id uuid primary key default gen_random_uuid(),team_id uuid not null references public.taskboard_teams on delete cascade,
title text not null check(char_length(trim(title)) between 1 and 100),created_at timestamptz not null default now(),unique(id,team_id));
create table public.taskboard_shared_tasks(
id uuid primary key default gen_random_uuid(),project_id uuid not null,team_id uuid not null,
title text not null check(char_length(trim(title)) between 1 and 200),description text not null default '' check(char_length(description)<=10000),
status text not null default 'todo' check(status in ('todo','in-progress','done')),
assignee_id uuid,created_at timestamptz not null default now(),
foreign key(project_id,team_id) references public.taskboard_shared_projects(id,team_id) on delete cascade,
foreign key(team_id,assignee_id) references public.taskboard_team_members(team_id,user_id) on delete set null(assignee_id));
create index on public.taskboard_shared_projects(team_id);
create index on public.taskboard_shared_tasks(project_id);
create index on public.taskboard_shared_tasks(team_id,assignee_id);
alter table public.taskboard_shared_projects enable row level security;
alter table public.taskboard_shared_tasks enable row level security;
grant select,insert,update,delete on public.taskboard_shared_projects,public.taskboard_shared_tasks to authenticated;
revoke all on public.taskboard_shared_projects,public.taskboard_shared_tasks from anon;
create policy shared_projects_read on public.taskboard_shared_projects for select to authenticated using(public.is_taskboard_team_member(team_id));
create policy shared_projects_insert on public.taskboard_shared_projects for insert to authenticated with check(public.taskboard_manage_team(team_id));
create policy shared_projects_update on public.taskboard_shared_projects for update to authenticated using(public.taskboard_manage_team(team_id)) with check(public.taskboard_manage_team(team_id));
create policy shared_projects_delete on public.taskboard_shared_projects for delete to authenticated using(public.taskboard_manage_team(team_id));
create policy shared_tasks_read on public.taskboard_shared_tasks for select to authenticated using(public.is_taskboard_team_member(team_id));
create policy shared_tasks_insert on public.taskboard_shared_tasks for insert to authenticated with check(public.taskboard_edit_team(team_id));
create policy shared_tasks_update on public.taskboard_shared_tasks for update to authenticated using(public.taskboard_edit_team(team_id)) with check(public.taskboard_edit_team(team_id));
create policy shared_tasks_delete on public.taskboard_shared_tasks for delete to authenticated using(public.taskboard_edit_team(team_id));


-- Do not expose intermediate invitation implementations. Next stage will
-- install and test the hardened lifecycle before granting client access.
revoke all on public.taskboard_team_invitations from public,anon,authenticated;
revoke all on function public.accept_taskboard_team_invitation(uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.cancel_taskboard_invitation(uuid) from public,anon,authenticated,service_role;

-- Atomic owner registration; clients cannot forge membership rows.
create function maat_private.register_team_owner()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.taskboard_team_members(team_id,user_id,role) values(new.id,new.owner_id,'owner');
 return new;
end$$;
revoke all on function maat_private.register_team_owner() from public,anon,authenticated,service_role;
create trigger taskboard_register_owner after insert on public.taskboard_teams
 for each row execute function maat_private.register_team_owner();
revoke insert,update,delete on public.taskboard_team_members from public,anon,authenticated;

-- Public functions are invokers; privileged implementations stay private.
do $$declare f record; definition text; args text;
begin
 for f in select p.*,p.oid as function_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in
 ('is_taskboard_team_member','taskboard_manage_team','taskboard_edit_team','manage_taskboard_member','taskboard_team_roster') loop
  definition:=replace(pg_get_functiondef(f.function_oid),format('FUNCTION public.%I(',f.proname),format('FUNCTION maat_private.%I(',f.proname));
  execute definition;
  execute format('alter function maat_private.%I(%s) set search_path to %L',f.proname,pg_get_function_identity_arguments(f.function_oid),'');
  select string_agg(format('$%s',i),', ' order by i) into args from generate_series(1,f.pronargs) i;
  execute format('create or replace function public.%I(%s) returns %s language sql %s security invoker set search_path='''' as %L',
    f.proname,pg_get_function_arguments(f.function_oid),pg_get_function_result(f.function_oid),
    case f.provolatile when 's' then 'stable' when 'i' then 'immutable' else 'volatile' end,
    format('select * from maat_private.%I(%s);',f.proname,coalesce(args,'')));
  execute format('revoke all on function maat_private.%I(%s) from public,anon,authenticated,service_role',f.proname,pg_get_function_identity_arguments(f.function_oid));
  execute format('grant execute on function maat_private.%I(%s) to authenticated,service_role',f.proname,pg_get_function_identity_arguments(f.function_oid));
  execute format('revoke all on function public.%I(%s) from public,anon,authenticated,service_role',f.proname,pg_get_function_identity_arguments(f.function_oid));
  execute format('grant execute on function public.%I(%s) to authenticated,service_role',f.proname,pg_get_function_identity_arguments(f.function_oid));
 end loop;
end$$;
grant usage on schema maat_private to service_role;
-- Default privileges restored from Supabase must not accidentally expose tables.
revoke all on public.taskboard_teams,public.taskboard_team_members,
 public.taskboard_shared_projects,public.taskboard_shared_tasks from public,anon,authenticated;
grant select,insert,update,delete on public.taskboard_teams,
 public.taskboard_shared_projects,public.taskboard_shared_tasks to authenticated;
grant select on public.taskboard_team_members to authenticated;


-- Stage: invitations

set local lock_timeout='5s';
set local statement_timeout='30s';
create table public.taskboard_account_status (
 user_id uuid primary key references auth.users(id) on delete cascade,
 suspended boolean not null default false,changed_at timestamptz not null default now());
alter table public.taskboard_account_status enable row level security;
revoke all on public.taskboard_account_status from public,anon,authenticated;
grant select on public.taskboard_account_status to authenticated;
grant select,insert,update on public.taskboard_account_status to service_role;
create policy account_status_self on public.taskboard_account_status for select to authenticated using(user_id=(select auth.uid()));
-- Deletion-processing guards will be integrated in the later account lifecycle stage.
create function maat_private.account_can_operate() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.users where id=auth.uid())
 and not exists(select 1 from public.taskboard_account_status where user_id=auth.uid() and suspended);
$$;
revoke all on function maat_private.account_can_operate() from public,anon,authenticated,service_role;
grant execute on function maat_private.account_can_operate() to authenticated,service_role,maat_workspace_writer;
create function public.taskboard_account_active() returns boolean
language sql stable security invoker set search_path='' as $$select maat_private.account_can_operate();$$;
revoke all on function public.taskboard_account_active() from public,anon,authenticated,service_role;
grant execute on function public.taskboard_account_active() to authenticated,service_role;

create or replace function maat_private.is_taskboard_team_member(team_uuid uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.taskboard_account_active() and exists(select 1 from public.taskboard_team_members where team_id=team_uuid and user_id=auth.uid());
$$;
create or replace function maat_private.taskboard_manage_team(tid uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.taskboard_account_active() and exists(select 1 from public.taskboard_teams t where t.id=tid
 and (t.owner_id=auth.uid() or exists(select 1 from public.taskboard_team_members m where m.team_id=t.id and m.user_id=auth.uid() and m.role='admin')));
$$;
create or replace function maat_private.taskboard_edit_team(tid uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.taskboard_account_active() and exists(select 1 from public.taskboard_team_members where team_id=tid and user_id=auth.uid() and role in ('owner','admin','member'));
$$;
do $$declare definition text;begin
 definition:=pg_get_functiondef('maat_private.manage_taskboard_member(uuid,uuid,text)'::regprocedure);
 definition:=regexp_replace(definition,'\mbegin\M',
 E'begin\n if not public.taskboard_account_active() then raise exception ''Account unavailable'' using errcode=''42501''; end if;','i');
 execute definition;
end$$;

-- Apply to TEST first. Stable public API, private privileged implementations.

create schema if not exists maat_private;
grant usage on schema maat_private to authenticated,service_role;
create or replace function maat_private.register_team_owner()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.taskboard_team_members(team_id,user_id,role) values(new.id,new.owner_id,'owner');
 return new;
end $$;
revoke all on function maat_private.register_team_owner() from public,anon,authenticated;
drop trigger if exists taskboard_register_owner on public.taskboard_teams;
create trigger taskboard_register_owner after insert on public.taskboard_teams
for each row execute function maat_private.register_team_owner();
insert into public.taskboard_team_members(team_id,user_id,role)
select id,owner_id,'owner' from public.taskboard_teams
on conflict(team_id,user_id) do update set role='owner';
revoke insert on public.taskboard_team_members from authenticated;
drop policy if exists invitations_create_admin on public.taskboard_team_invitations;
create policy invitations_create_admin on public.taskboard_team_invitations
for insert to authenticated with check (
 invited_by=auth.uid() and public.taskboard_manage_team(team_id)
 and (role<>'admin' or exists(select 1 from public.taskboard_teams t where t.id=team_id and t.owner_id=auth.uid()))
 and accepted_at is null and expires_at>now() and expires_at<=now()+interval '7 days'
 and char_length(token_hash)>=64
);

create or replace function public.accept_taskboard_team_invitation(invitation_id uuid, invitation_token text)
returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.taskboard_team_invitations%rowtype; tid uuid; team_owner uuid; recipient text;
begin
 if not public.taskboard_account_active() then raise exception 'Connexion requise ou compte suspendu.' using errcode='42501'; end if;
 select u.email into recipient from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 if recipient is null then raise exception 'Confirmez votre adresse email.' using errcode='42501'; end if;
 if invitation_token is null or char_length(invitation_token)<64 then raise exception 'Invitation invalide.' using errcode='22023'; end if;
 select i.team_id into tid from public.taskboard_team_invitations i where i.id=invitation_id;
 -- Same lock order as membership changes: team, then invitation/member.
 select t.owner_id into team_owner from public.taskboard_teams t where t.id=tid for update;
 if not found then raise exception 'Invitation invalide.' using errcode='22023'; end if;
 select * into invitation from public.taskboard_team_invitations i
 where i.id=invitation_id and i.team_id=tid and i.token_hash=invitation_token for update;
 if not found or lower(invitation.email) is distinct from lower(recipient) then
  raise exception 'Invitation invalide pour ce compte.' using errcode='42501';
 end if;
 if invitation.accepted_at is not null then
  if exists(select 1 from public.taskboard_team_members m where m.team_id=tid and m.user_id=auth.uid()) then return tid; end if;
  raise exception 'Invitation déjà utilisée.' using errcode='22023';
 end if;
 if invitation.expires_at<=now() then raise exception 'Invitation expirée.' using errcode='22023'; end if;
 if exists(select 1 from public.taskboard_account_status s where s.user_id=invitation.invited_by and s.suspended)
 or (invitation.invited_by<>team_owner and (
   invitation.role='admin' or not exists(select 1 from public.taskboard_team_members m
    where m.team_id=tid and m.user_id=invitation.invited_by and m.role='admin')
 )) then raise exception 'Droits retirés : demandez une nouvelle invitation.' using errcode='42501'; end if;
 insert into public.taskboard_team_members(team_id,user_id,role)
 values(tid,auth.uid(),invitation.role) on conflict(team_id,user_id) do nothing;
 update public.taskboard_team_invitations set accepted_at=now() where id=invitation.id;
 return tid;
end $$;

create or replace function public.cancel_taskboard_invitation(invitation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare tid uuid;
begin
 if not public.taskboard_account_active() then raise exception 'Connexion requise ou compte suspendu.' using errcode='42501'; end if;
 select i.team_id into tid from public.taskboard_team_invitations i where i.id=invitation_id;
 perform 1 from public.taskboard_teams t where t.id=tid for update;
 delete from public.taskboard_team_invitations i where i.id=invitation_id
 and i.accepted_at is null and public.taskboard_manage_team(i.team_id)
 and (i.role<>'admin' or exists(select 1 from public.taskboard_teams t where t.id=i.team_id and t.owner_id=auth.uid()));
 if not found then raise exception 'Invitation acceptée, introuvable ou accès refusé.' using errcode='42501'; end if;
end $$;

-- Preserve return types, argument defaults and volatility; no caller-supplied actor.
do $$
declare f record; definition text; call_args text; private_name text;
begin
 for f in select p.*,p.oid as function_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in (
 'accept_taskboard_team_invitation','cancel_taskboard_invitation',
 'manage_taskboard_member','is_taskboard_team_member','taskboard_edit_team',
 'taskboard_manage_team','taskboard_team_roster','progress_taskboard_work') loop
  private_name:=format('maat_private.%I',f.proname);
  definition:=replace(pg_get_functiondef(f.function_oid),format('FUNCTION public.%I(',f.proname),'FUNCTION '||private_name||'(');
  if f.prosecdef then execute definition; end if;
  select string_agg(format('$%s',i),', ' order by i) into call_args from generate_series(1,f.pronargs) i;
  execute format('create or replace function public.%I(%s) returns %s language sql %s security invoker set search_path='''' as %L',
   f.proname,pg_get_function_arguments(f.function_oid),pg_get_function_result(f.function_oid),
   case f.provolatile when 's' then 'stable' when 'i' then 'immutable' else 'volatile' end,
   'select * from '||private_name||'('||coalesce(call_args,'')||');');
  execute format('revoke all on function %s(%s) from public,anon,authenticated,service_role',private_name,pg_get_function_identity_arguments(f.function_oid));
  execute format('grant execute on function %s(%s) to authenticated,service_role',private_name,pg_get_function_identity_arguments(f.function_oid));
  execute format('revoke all on function public.%I(%s) from public,anon',f.proname,pg_get_function_identity_arguments(f.function_oid));
  execute format('grant execute on function public.%I(%s) to authenticated,service_role',f.proname,pg_get_function_identity_arguments(f.function_oid));
 end loop;
end $$;


-- Separate RPC: old clients keep using taskboard_team_roster() unchanged.
-- Metadata is presentation only; authorization comes exclusively from membership.
create schema if not exists maat_private;
revoke all on schema maat_private from public,anon;
grant usage on schema maat_private to authenticated;
create or replace function maat_private.team_profiles()
returns table(team_id uuid,user_id uuid,role text,display_name text,avatar_url text)
language sql stable security definer set search_path='' as $$
select m.team_id,m.user_id,m.role,
 coalesce(
  nullif(trim(concat_ws(' ',nullif(trim(u.raw_user_meta_data->>'first_name'),''),nullif(trim(u.raw_user_meta_data->>'last_name'),''))),''),
  nullif(trim(u.raw_user_meta_data->>'full_name'),''),
  nullif(trim(u.raw_user_meta_data->>'name'),''),'Membre'),
 case when u.raw_user_meta_data->>'avatar_url' like 'https://%' then u.raw_user_meta_data->>'avatar_url' else null end
from public.taskboard_team_members m join auth.users u on u.id=m.user_id
where (select auth.uid()) is not null and public.is_taskboard_team_member(m.team_id);
$$;
revoke all on function maat_private.team_profiles() from public,anon;
grant execute on function maat_private.team_profiles() to authenticated;

create or replace function public.taskboard_team_profiles()
returns table(team_id uuid,user_id uuid,role text,display_name text,avatar_url text)
language sql stable security invoker set search_path='' as $$
select * from maat_private.team_profiles();
$$;
revoke all on function public.taskboard_team_profiles() from public,anon;
grant execute on function public.taskboard_team_profiles() to authenticated;

-- Client creation/reading only. Accept/cancel use private checked functions.
revoke all on public.taskboard_team_invitations from public,anon,authenticated;
grant select,insert on public.taskboard_team_invitations to authenticated;
do $$declare t text;begin
 foreach t in array array['taskboard_teams','taskboard_team_members','taskboard_team_invitations','taskboard_shared_projects','taskboard_shared_tasks'] loop
  execute format('create policy account_active_required on public.%I as restrictive for all to authenticated using ((select public.taskboard_account_active())) with check ((select public.taskboard_account_active()))',t);
 end loop;
end$$;


-- Stage: notifications

set local lock_timeout='5s';
set local statement_timeout='30s';
do $$begin
 if to_regclass('public.taskboard_account_status') is null or to_regclass('public.taskboard_notifications') is not null then
  raise exception 'Expected invitations-only rehearsal baseline';
 end if;
 -- A local filtered restore has no platform publication. Catalog only; not a
 -- running Supabase Realtime service and not a network-delivery assertion.
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then
  create publication supabase_realtime;
 end if;
end$$;
-- Reviewed source: shared-subtasks-notifications.sql
alter table public.taskboard_shared_tasks add constraint shared_task_id_team unique(id,team_id);
create table public.taskboard_shared_subtasks(
id uuid primary key default gen_random_uuid(),task_id uuid not null,team_id uuid not null,
title text not null check(char_length(trim(title)) between 1 and 200),
completed boolean not null default false,assignee_id uuid,created_at timestamptz not null default now(),
foreign key(task_id,team_id) references public.taskboard_shared_tasks(id,team_id) on delete cascade,
foreign key(team_id,assignee_id) references public.taskboard_team_members(team_id,user_id) on delete set null(assignee_id));
create index on public.taskboard_shared_subtasks(task_id);
create index on public.taskboard_shared_subtasks(team_id,assignee_id);
alter table public.taskboard_shared_subtasks enable row level security;
grant select,insert,update,delete on public.taskboard_shared_subtasks to authenticated;
revoke all on public.taskboard_shared_subtasks from anon;
create policy subtasks_read on public.taskboard_shared_subtasks for select to authenticated using(public.is_taskboard_team_member(team_id));
create policy subtasks_insert on public.taskboard_shared_subtasks for insert to authenticated with check(public.taskboard_edit_team(team_id));
create policy subtasks_update on public.taskboard_shared_subtasks for update to authenticated using(public.taskboard_edit_team(team_id)) with check(public.taskboard_edit_team(team_id));
create policy subtasks_delete on public.taskboard_shared_subtasks for delete to authenticated using(public.taskboard_edit_team(team_id));
create or replace function public.progress_taskboard_work(work_id uuid,is_subtask boolean,new_status text)
returns void language plpgsql security definer set search_path='' as $$
declare tid uuid;assigned uuid;
begin
if auth.uid() is null then raise exception 'Connexion requise.';end if;
if is_subtask then
select team_id,assignee_id into tid,assigned from public.taskboard_shared_subtasks where id=work_id for update;
else
select team_id,assignee_id into tid,assigned from public.taskboard_shared_tasks where id=work_id for update;
end if;
if tid is null or not public.is_taskboard_team_member(tid) or (not public.taskboard_edit_team(tid) and assigned is distinct from auth.uid()) then raise exception 'Ce travail ne vous est pas assigné.';end if;
if is_subtask then
if new_status not in ('done','todo') or new_status is null then raise exception 'État invalide.';end if;
update public.taskboard_shared_subtasks set completed=(new_status='done') where id=work_id;
else
if new_status not in ('todo','in-progress','done') or new_status is null then raise exception 'Statut invalide.';end if;
update public.taskboard_shared_tasks set status=new_status where id=work_id;
end if;
end; $$;
revoke all on function public.progress_taskboard_work(uuid,boolean,text) from public,anon;
grant execute on function public.progress_taskboard_work(uuid,boolean,text) to authenticated;
create table public.taskboard_notifications(
id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,
team_id uuid not null references public.taskboard_teams on delete cascade,
project_id uuid not null references public.taskboard_shared_projects on delete cascade,
task_id uuid not null references public.taskboard_shared_tasks on delete cascade,
title text not null,read_at timestamptz,created_at timestamptz not null default now());
create index on public.taskboard_notifications(user_id,created_at desc);
alter table public.taskboard_notifications enable row level security;
grant select on public.taskboard_notifications to authenticated;
grant update(read_at) on public.taskboard_notifications to authenticated;
revoke all on public.taskboard_notifications from anon;
create policy notifications_read on public.taskboard_notifications for select to authenticated using(user_id=auth.uid() and public.is_taskboard_team_member(team_id));
create policy notifications_update on public.taskboard_notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create or replace function public.notify_taskboard_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
declare pid uuid;parent uuid;
begin
if new.assignee_id is null then return new;end if;
if tg_op='UPDATE' then if new.assignee_id is not distinct from old.assignee_id then return new;end if;end if;
if tg_table_name='taskboard_shared_subtasks' then
parent:=new.task_id;select project_id into pid from public.taskboard_shared_tasks where id=parent;
else parent:=new.id;pid:=new.project_id;end if;
insert into public.taskboard_notifications(user_id,team_id,project_id,task_id,title)
values(new.assignee_id,new.team_id,pid,parent,'Assignation : '||new.title);
return new;
end; $$;
revoke all on function public.notify_taskboard_assignment() from public,anon,authenticated;
create trigger task_assignment after insert or update of assignee_id on public.taskboard_shared_tasks for each row execute function public.notify_taskboard_assignment();
create trigger subtask_assignment after insert or update of assignee_id on public.taskboard_shared_subtasks for each row execute function public.notify_taskboard_assignment();

-- Reviewed source: shared-task-workflow.sql
-- Start a shared task when a subtask is checked, including assigned readers.
create or replace function public.start_taskboard_parent_task()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not new.completed then return new; end if;
  if TG_OP = 'UPDATE' then
    if old.completed then return new; end if;
  end if;
  update public.taskboard_shared_tasks
  set status = 'in-progress'
  where id = new.task_id and team_id = new.team_id and status = 'todo';
  return new;
end;
$$;
revoke all on function public.start_taskboard_parent_task() from public, anon, authenticated;
create or replace trigger taskboard_subtask_start_parent
after insert or update of completed on public.taskboard_shared_subtasks
for each row execute function public.start_taskboard_parent_task();

-- Reviewed source: checklist-workflow.sql
-- Checklist transitions only: no migration of existing task statuses.
drop trigger if exists taskboard_subtask_start_parent on public.taskboard_shared_subtasks;
create or replace function maat_private.lock_checklist_parent()
returns trigger language plpgsql security definer set search_path='' as $$
declare parent uuid;tid uuid;
begin
 if tg_op='DELETE' then parent:=old.task_id;tid:=old.team_id;
 else parent:=new.task_id;tid:=new.team_id;end if;
 if auth.uid() is null or not public.is_taskboard_team_member(tid) then
  if tg_op='DELETE' then return old;else return new;end if;
 end if;
 perform 1 from public.taskboard_shared_tasks where id=parent and team_id=tid for update;
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;
revoke all on function maat_private.lock_checklist_parent() from public,anon,authenticated;
create or replace function maat_private.sync_checklist_parent()
returns trigger language plpgsql security definer set search_path='' as $$
declare parent uuid;tid uuid;total integer;finished integer;current_status text;target text;
begin
 if tg_op='DELETE' then parent:=old.task_id;tid:=old.team_id;
 else parent:=new.task_id;tid:=new.team_id;end if;
 if auth.uid() is null or not public.is_taskboard_team_member(tid) then return null;end if;
 if tg_op='UPDATE' and new.completed is not distinct from old.completed then return null;end if;
 select status into current_status from public.taskboard_shared_tasks where id=parent and team_id=tid for update;
 if not found then return null;end if;
 select count(*),count(*) filter(where completed) into total,finished
 from public.taskboard_shared_subtasks where task_id=parent and team_id=tid;
 if total=0 then return null;end if;
 target:=current_status;
 if finished=total then target:='done';
 elsif finished>0 or current_status='done' then target:='in-progress';end if;
 if target<>current_status then
  update public.taskboard_shared_tasks set status=target where id=parent and team_id=tid;
 end if;
 return null;
end;$$;
revoke all on function maat_private.sync_checklist_parent() from public,anon,authenticated;
create trigger checklist_lock_parent before insert or update of completed or delete on public.taskboard_shared_subtasks
for each row execute function maat_private.lock_checklist_parent();
create trigger checklist_sync_parent after insert or update of completed or delete on public.taskboard_shared_subtasks
for each row execute function maat_private.sync_checklist_parent();

-- Lock the parent before the child so simultaneous sibling updates serialize.
create or replace function public.progress_taskboard_work(work_id uuid,is_subtask boolean,new_status text)
returns void language plpgsql security definer set search_path='' as $$
declare tid uuid;assigned uuid;parent uuid;
begin
 if auth.uid() is null then raise exception 'Connexion requise.';end if;
 if is_subtask then
  if new_status is null or new_status not in ('done','todo') then raise exception 'État invalide.';end if;
  select team_id,assignee_id,task_id into tid,assigned,parent from public.taskboard_shared_subtasks where id=work_id;
 else
  if new_status is null or new_status not in ('todo','in-progress','done') then raise exception 'Statut invalide.';end if;
  select team_id,assignee_id into tid,assigned from public.taskboard_shared_tasks where id=work_id;
  parent:=work_id;
 end if;
 if tid is null or not public.is_taskboard_team_member(tid) or (not public.taskboard_edit_team(tid) and assigned is distinct from auth.uid()) then raise exception 'Ce travail ne vous est pas assigné.';end if;
 perform 1 from public.taskboard_shared_tasks where id=parent and team_id=tid for update;
 if is_subtask then
  select team_id,assignee_id into tid,assigned from public.taskboard_shared_subtasks where id=work_id and task_id=parent for update;
 else
  select team_id,assignee_id into tid,assigned from public.taskboard_shared_tasks where id=work_id for update;
 end if;
 if tid is null or not public.is_taskboard_team_member(tid) or (not public.taskboard_edit_team(tid) and assigned is distinct from auth.uid()) then raise exception 'Ce travail ne vous est pas assigné.';end if;
 if is_subtask then update public.taskboard_shared_subtasks set completed=(new_status='done') where id=work_id;
 else update public.taskboard_shared_tasks set status=new_status where id=work_id;end if;
end;$$;
revoke all on function public.progress_taskboard_work(uuid,boolean,text) from public,anon;
grant execute on function public.progress_taskboard_work(uuid,boolean,text) to authenticated;

-- Reviewed source: work-completion-notifications.sql
alter table public.taskboard_shared_tasks add column if not exists assigned_by uuid references auth.users(id) on delete set null;
alter table public.taskboard_shared_subtasks add column if not exists assigned_by uuid references auth.users(id) on delete set null;
create schema if not exists maat_private;
revoke all on schema maat_private from public,anon;

-- This trigger ignores caller-supplied assigned_by, including spoofed updates.
create or replace function maat_private.track_work_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then new.assigned_by:=null;
 else new.assigned_by:=old.assigned_by;end if;
 if tg_op='INSERT' or new.assignee_id is distinct from old.assignee_id then
  if new.assignee_id is null then new.assigned_by:=null;
  elsif auth.uid() is not null and public.taskboard_edit_team(new.team_id) then new.assigned_by:=auth.uid();
  else new.assigned_by:=null;end if;
 end if;
 return new;
end;$$;
revoke all on function maat_private.track_work_assignment() from public,anon,authenticated;
create trigger track_task_assignment before insert or update on public.taskboard_shared_tasks for each row execute function maat_private.track_work_assignment();
create trigger track_subtask_assignment before insert or update on public.taskboard_shared_subtasks for each row execute function maat_private.track_work_assignment();

create or replace function maat_private.notify_work_completion()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();recipient uuid;owner uuid;pid uuid;parent uuid;label text;
begin
 if actor is null or not public.is_taskboard_team_member(new.team_id) then return new;end if;
 if tg_table_name='taskboard_shared_subtasks' then
  if not new.completed or old.completed then return new;end if;
  parent:=new.task_id;
  select project_id into pid from public.taskboard_shared_tasks where id=parent;
  label:='Sous-tâche terminée : ';
 else
  if new.status<>'done' or old.status='done' then return new;end if;
  parent:=new.id;pid:=new.project_id;label:='Tâche terminée : ';
 end if;
 select owner_id into owner from public.taskboard_teams where id=new.team_id;
 recipient:=new.assigned_by;
 if recipient is null or not exists(select 1 from public.taskboard_team_members where team_id=new.team_id and user_id=recipient) then recipient:=owner;end if;
 if recipient is null or recipient=actor or not exists(select 1 from public.taskboard_team_members where team_id=new.team_id and user_id=recipient) then return new;end if;
 insert into public.taskboard_notifications(user_id,team_id,project_id,task_id,title)
 values(recipient,new.team_id,pid,parent,label||new.title);
 return new;
end;$$;
revoke all on function maat_private.notify_work_completion() from public,anon,authenticated;
create trigger task_completed after update of status on public.taskboard_shared_tasks for each row execute function maat_private.notify_work_completion();
create trigger subtask_completed after update of completed on public.taskboard_shared_subtasks for each row execute function maat_private.notify_work_completion();

-- Reviewed source: notification-navigation.sql
alter table public.taskboard_notifications add column if not exists subtask_id uuid references public.taskboard_shared_subtasks(id) on delete set null;
create index if not exists notifications_subtask_idx on public.taskboard_notifications(subtask_id) where subtask_id is not null;
create or replace function maat_private.notify_work_completion()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();recipient uuid;owner uuid;pid uuid;parent uuid;sub uuid;label text;
begin
 if actor is null or not public.is_taskboard_team_member(new.team_id) then return new;end if;
 if tg_table_name='taskboard_shared_subtasks' then
  if not new.completed or old.completed then return new;end if;
  sub:=new.id;parent:=new.task_id;
  select project_id into pid from public.taskboard_shared_tasks where id=parent;
  label:='Sous-tâche terminée : ';
 else
  if new.status<>'done' or old.status='done' then return new;end if;
  parent:=new.id;pid:=new.project_id;label:='Tâche terminée : ';
 end if;
 select owner_id into owner from public.taskboard_teams where id=new.team_id;
 recipient:=new.assigned_by;
 if recipient is null or not exists(select 1 from public.taskboard_team_members where team_id=new.team_id and user_id=recipient) then recipient:=owner;end if;
 if recipient is null or recipient=actor or not exists(select 1 from public.taskboard_team_members where team_id=new.team_id and user_id=recipient) then return new;end if;
 insert into public.taskboard_notifications(user_id,team_id,project_id,task_id,title,subtask_id)
 values(recipient,new.team_id,pid,parent,label||new.title,sub);
 return new;
end;$$;
revoke all on function maat_private.notify_work_completion() from public,anon,authenticated;
create or replace function public.notify_taskboard_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
declare pid uuid;parent uuid;sub uuid;
begin
if new.assignee_id is null then return new;end if;
if tg_op='UPDATE' then if new.assignee_id is not distinct from old.assignee_id then return new;end if;end if;
if tg_table_name='taskboard_shared_subtasks' then
sub:=new.id;parent:=new.task_id;select project_id into pid from public.taskboard_shared_tasks where id=parent;
else parent:=new.id;pid:=new.project_id;end if;
insert into public.taskboard_notifications(user_id,team_id,project_id,task_id,title,subtask_id)
values(new.assignee_id,new.team_id,pid,parent,'Assignation : '||new.title,sub);
return new;
end; $$;
revoke all on function public.notify_taskboard_assignment() from public,anon,authenticated;


-- Reviewed source: notification-preferences.sql
-- Apply to Maat-test first. Existing notifications are never changed.

create table public.taskboard_notification_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 assignments boolean not null default true,
 completions boolean not null default true
);
alter table public.taskboard_notification_preferences enable row level security;
revoke all on public.taskboard_notification_preferences from public,anon,authenticated;
grant select,insert,update on public.taskboard_notification_preferences to authenticated;
grant all on public.taskboard_notification_preferences to service_role;
create policy preferences_self_read on public.taskboard_notification_preferences for select to authenticated
 using(user_id=(select auth.uid()) and (select public.taskboard_account_active()));
create policy preferences_self_insert on public.taskboard_notification_preferences for insert to authenticated
 with check(user_id=(select auth.uid()) and (select public.taskboard_account_active()));
create policy preferences_self_update on public.taskboard_notification_preferences for update to authenticated
 using(user_id=(select auth.uid()) and (select public.taskboard_account_active()))
 with check(user_id=(select auth.uid()) and (select public.taskboard_account_active()));

-- Preserve the deployed trigger logic, adding an explicit recipient preference
-- guard. These functions already run with definer privileges and are not RPCs.
do $$
declare definition text; needle text := 'insert into public.taskboard_notifications('; replacement text;
begin
 definition := pg_get_functiondef('public.notify_taskboard_assignment()'::regprocedure);
 if strpos(definition,'taskboard_notification_preferences')>0 or
    (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then
   raise exception 'Unexpected assignment function; no changes committed';
 end if;
 replacement := E'if exists(select 1 from public.taskboard_notification_preferences where user_id=new.assignee_id and not assignments) then return new; end if;\n' || needle;
 execute replace(definition,needle,replacement);
 definition := pg_get_functiondef('maat_private.notify_work_completion()'::regprocedure);
 if strpos(definition,'taskboard_notification_preferences')>0 or
    (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then
   raise exception 'Unexpected completion function; no changes committed';
 end if;
 replacement := E'if exists(select 1 from public.taskboard_notification_preferences where user_id=recipient and not completions) then return new; end if;\n' || needle;
 execute replace(definition,needle,replacement);
end $$;
revoke all on function public.notify_taskboard_assignment() from public,anon,authenticated;
revoke all on function maat_private.notify_work_completion() from public,anon,authenticated;


-- Reviewed source: dismiss-notifications.sql
-- Soft dismissal: only the recipient may update this field through existing RLS.
alter table public.taskboard_notifications add column if not exists dismissed_at timestamptz;
grant update(dismissed_at) on public.taskboard_notifications to authenticated;

-- Reviewed source: enriched-realtime-notifications.sql
alter table public.taskboard_notifications
 add column if not exists actor_name text,
 add column if not exists actor_avatar_url text,
 add column if not exists project_name text;
create or replace function maat_private.enrich_notification()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.actor_name:=null;new.actor_avatar_url:=null;new.project_name:=null;
 if auth.uid() is not null and public.is_taskboard_team_member(new.team_id) then
  select coalesce(nullif(trim(concat_ws(' ',nullif(trim(raw_user_meta_data->>'first_name'),''),nullif(trim(raw_user_meta_data->>'last_name'),''))),''),nullif(trim(raw_user_meta_data->>'full_name'),''),nullif(trim(raw_user_meta_data->>'name'),''),'Membre'),
   case when raw_user_meta_data->>'avatar_url' like 'https://%' then raw_user_meta_data->>'avatar_url' end
  into new.actor_name,new.actor_avatar_url from auth.users where id=auth.uid();
 end if;
 select title into new.project_name from public.taskboard_shared_projects where id=new.project_id and team_id=new.team_id;
 return new;
end;$$;
revoke all on function maat_private.enrich_notification() from public,anon,authenticated;
drop trigger if exists enrich_notification on public.taskboard_notifications;
create trigger enrich_notification before insert on public.taskboard_notifications for each row execute function maat_private.enrich_notification();
-- Read state is the only field a recipient may modify.
revoke update on public.taskboard_notifications from authenticated;
revoke update(id,user_id,team_id,project_id,task_id,title,created_at,actor_name,actor_avatar_url,project_name) on public.taskboard_notifications from authenticated;
grant update(read_at) on public.taskboard_notifications to authenticated;
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='taskboard_notifications') then
  alter publication supabase_realtime add table public.taskboard_notifications;
 end if;
end $$;

-- Reviewed source: shared-realtime.sql
-- INSERT/UPDATE realtime respects existing SELECT policies; no new grants.
do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='taskboard_shared_tasks') then
    alter publication supabase_realtime add table public.taskboard_shared_tasks;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='taskboard_shared_subtasks') then
    alter publication supabase_realtime add table public.taskboard_shared_subtasks;
  end if;
end $$;

-- Keep the independent email preference off; no queue or sender in this stage.
alter table public.taskboard_notification_preferences add column email_assignments boolean not null default false;
-- Supabase default grants include broad table rights. Replace them explicitly.
revoke all on public.taskboard_shared_subtasks,public.taskboard_notifications from public,anon,authenticated;
grant select,insert,update,delete on public.taskboard_shared_subtasks to authenticated;
grant select on public.taskboard_notifications to authenticated;
grant update(read_at,dismissed_at) on public.taskboard_notifications to authenticated;
revoke all on function public.notify_taskboard_assignment(),public.start_taskboard_parent_task() from public,anon,authenticated,service_role;
revoke all on function maat_private.notify_work_completion(),maat_private.enrich_notification(),
 maat_private.track_work_assignment(),maat_private.lock_checklist_parent(),maat_private.sync_checklist_parent()
 from public,anon,authenticated,service_role;

do $$declare definition text;begin
 definition:=pg_get_functiondef('public.progress_taskboard_work(uuid,boolean,text)'::regprocedure);
 definition:=replace(definition,'FUNCTION public.progress_taskboard_work(','FUNCTION maat_private.progress_taskboard_work(');
 execute definition;
end$$;
create or replace function public.progress_taskboard_work(work_id uuid,is_subtask boolean,new_status text)
returns void language sql security invoker set search_path='' as $$
 select maat_private.progress_taskboard_work(work_id,is_subtask,new_status);
$$;
revoke all on function public.progress_taskboard_work(uuid,boolean,text),maat_private.progress_taskboard_work(uuid,boolean,text) from public,anon,authenticated,service_role;
grant execute on function public.progress_taskboard_work(uuid,boolean,text),maat_private.progress_taskboard_work(uuid,boolean,text) to authenticated,service_role;
create policy account_active_required on public.taskboard_shared_subtasks as restrictive for all to authenticated
 using ((select public.taskboard_account_active())) with check ((select public.taskboard_account_active()));
create policy account_active_required on public.taskboard_notifications as restrictive for all to authenticated
 using ((select public.taskboard_account_active())) with check ((select public.taskboard_account_active()));


-- Stage: admin-lifecycle

set local lock_timeout='5s';
set local statement_timeout='30s';
-- Foundation only: requests remain disabled until the purge worker is validated.

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


alter table maat_private.account_deletion_config enable row level security;
alter table maat_private.account_deletion_config add column execution_enabled boolean not null default false;
revoke all on maat_private.account_deletion_config from public,anon,authenticated,service_role;
-- Prevent stale JWTs and processing accounts from using the application.
-- Apply after account-deletion.sql and account-security.sql on TEST first.
create or replace function maat_private.account_can_operate()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
 and exists(select 1 from auth.users u where u.id=auth.uid())
 and not exists(select 1 from public.taskboard_account_status s where s.user_id=auth.uid() and s.suspended)
 and not exists(select 1 from public.taskboard_account_deletions d where d.user_id=auth.uid() and d.status='processing');
$$;
revoke all on function maat_private.account_can_operate() from public,anon;
grant execute on function maat_private.account_can_operate() to authenticated,service_role;

create or replace function public.taskboard_account_active()
returns boolean language sql stable security invoker set search_path='' as $$
 select maat_private.account_can_operate();
$$;
revoke all on function public.taskboard_account_active() from public,anon;
grant execute on function public.taskboard_account_active() to authenticated,service_role;

-- Audit additions without resetting existing history.
alter table public.taskboard_admin_audit add column target_id uuid,
 add column reason text,add column auth_sync text check(auth_sync in ('pending','success','failed'));
alter table public.taskboard_admin_audit drop constraint taskboard_admin_audit_action_check;
alter table public.taskboard_admin_audit add constraint taskboard_admin_audit_action_check
 check(action in ('dashboard_view','account_suspend','account_reactivate'));
grant update(auth_sync) on public.taskboard_admin_audit to service_role;
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

-- Principal bootstrap deliberately omitted; separate authorized operation.

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

-- Coordinate moderation with role revocation/permission edits in one transaction.
create or replace function maat_private.require_admin_scope(actor uuid, scope text)
returns void language plpgsql security definer set search_path='' as $$
declare principal uuid;
begin
  select principal_id into principal from maat_private.admin_control where singleton for update;
  if not exists(select 1 from maat_private.admin_members m where m.user_id=actor
    and (actor=principal or scope=any(m.permissions))) then
    raise exception 'Permission required' using errcode='42501';
  end if;
end;
$$;
revoke all on function maat_private.require_admin_scope(uuid,text) from public,anon,authenticated;
grant execute on function maat_private.require_admin_scope(uuid,text) to service_role;

create or replace function public.taskboard_set_account_status(
 actor uuid, actor_email text, target uuid, target_email text,
 new_suspended boolean, expected_suspended boolean, action_reason text)
returns bigint language plpgsql security invoker set search_path='' as $$
declare audit_id bigint; previous boolean;
begin
 perform maat_private.require_admin_scope(actor,'users_manage');
 if actor=target then raise exception 'Own account protected' using errcode='42501'; end if;
 if not exists(select 1 from public.taskboard_admin_allowlist where email=lower(actor_email))
 or exists(select 1 from public.taskboard_account_status where user_id=actor and suspended)
 then raise exception 'Administrator required' using errcode='42501'; end if;
 if exists(select 1 from public.taskboard_admin_allowlist where email=lower(target_email))
 then raise exception 'Administrator protected' using errcode='42501'; end if;
 if new_suspended is null or expected_suspended is null or char_length(trim(coalesce(action_reason,''))) not between 10 and 500
 then raise exception 'Reason required' using errcode='22023'; end if;
 insert into public.taskboard_account_status(user_id) values(target) on conflict do nothing;
 select suspended into previous from public.taskboard_account_status where user_id=target for update;
 if previous<>expected_suspended or previous=new_suspended then raise exception 'Account changed' using errcode='PT409'; end if;
 update public.taskboard_account_status set suspended=new_suspended,changed_at=now() where user_id=target;
 insert into public.taskboard_admin_audit(actor_id,action,target_id,reason,auth_sync)
 values(actor,case when new_suspended then 'account_suspend' else 'account_reactivate' end,target,trim(action_reason),'pending') returning id into audit_id;
 return audit_id;
end;
$$;
revoke all on function public.taskboard_set_account_status(uuid,text,uuid,text,boolean,boolean,text) from public,anon,authenticated;
grant execute on function public.taskboard_set_account_status(uuid,text,uuid,text,boolean,boolean,text) to service_role;

-- Only public-facing contact/announcement text is stored in this readable table.
create table if not exists public.taskboard_platform_settings (
  singleton boolean primary key default true check(singleton),
  support_email text not null default '' check(length(support_email)<=254),
  announcement text not null default '' check(length(announcement)<=500),
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.taskboard_platform_settings enable row level security;
revoke all on public.taskboard_platform_settings from public,anon,authenticated;
grant select on public.taskboard_platform_settings to anon,authenticated;
grant select,insert,update on public.taskboard_platform_settings to service_role;
create policy public_platform_information on public.taskboard_platform_settings for select to anon,authenticated using(true);
insert into public.taskboard_platform_settings(singleton) values(true) on conflict do nothing;

create or replace function maat_private.update_platform_settings(actor uuid, session uuid,
  contact_email text, notice text, expected_version integer, action_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare access jsonb; result jsonb;
begin
  access:=maat_private.admin_access(actor,session,'identity');
  perform maat_private.require_admin_scope(actor,'settings_manage');
  if not (access->>'fresh')::boolean then raise exception 'Recent sign-in required' using errcode='PT401'; end if;
  if length(coalesce(contact_email,''))>254 or (coalesce(contact_email,'')<>'' and contact_email!~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
    or length(coalesce(notice,''))>500 or length(btrim(coalesce(action_reason,''))) not between 10 and 500 then
    raise exception 'Invalid settings' using errcode='22023'; end if;
  update public.taskboard_platform_settings set support_email=btrim(coalesce(contact_email,'')),announcement=btrim(coalesce(notice,'')),version=version+1,updated_at=now()
  where singleton and version=expected_version returning to_jsonb(taskboard_platform_settings.*) into result;
  if result is null then raise exception 'Settings changed' using errcode='PT409'; end if;
  insert into maat_private.admin_access_events(actor_id,action,reason) values(actor,'settings_update',btrim(action_reason));
  return result;
end;
$$;
revoke all on function maat_private.update_platform_settings(uuid,uuid,text,text,integer,text) from public,anon,authenticated;
grant execute on function maat_private.update_platform_settings(uuid,uuid,text,text,integer,text) to service_role;
create or replace function public.taskboard_update_platform_settings(actor uuid, session uuid,
  contact_email text, notice text, expected_version integer, action_reason text)
returns jsonb language sql security invoker set search_path='' as $$
  select maat_private.update_platform_settings(actor,session,contact_email,notice,expected_version,action_reason);
$$;
revoke all on function public.taskboard_update_platform_settings(uuid,uuid,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.taskboard_update_platform_settings(uuid,uuid,text,text,integer,text) to service_role;

-- Service-only global search, applied before pagination. No invitation secrets
-- or private project/task contents are exposed by this projection.
create or replace function maat_private.admin_team_directory(search_query text default '', requested_page integer default 1)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  term text := lower(btrim(coalesce(search_query, '')));
begin
  if requested_page < 1 or requested_page > 10000 or requested_page is null or length(term) > 120 then
    raise exception 'Invalid team directory query' using errcode = '22023';
  end if;
  -- strpos deliberately treats %, _, commas and quotes as literal input.
  with matching as materialized (
    select t.id, t.name, t.owner_id, t.created_at, coalesce(u.email, '') as owner_email
    from public.taskboard_teams t
    left join auth.users u on u.id = t.owner_id
    where term = '' or strpos(lower(t.name), term) > 0
      or strpos(lower(coalesce(u.email, '')), term) > 0
      or strpos(t.id::text, term) > 0
      or strpos(t.owner_id::text, term) > 0
  ), page_rows as (
    select * from matching order by created_at desc, id desc
    limit 50 offset (requested_page - 1) * 50
  )
  select jsonb_build_object(
    'teams', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc, p.id desc) from page_rows p), '[]'::jsonb),
    'total', (select count(*) from matching), 'page', requested_page
  ) into result;
  return result;
end;
$$;
revoke all on function maat_private.admin_team_directory(text, integer) from public, anon, authenticated;
grant execute on function maat_private.admin_team_directory(text, integer) to service_role;
create or replace function public.taskboard_admin_team_directory(search_query text default '', requested_page integer default 1)
returns jsonb language sql security invoker set search_path='' as $$
  select maat_private.admin_team_directory(search_query,requested_page);
$$;
revoke all on function public.taskboard_admin_team_directory(text, integer) from public, anon, authenticated;
grant execute on function public.taskboard_admin_team_directory(text, integer) to service_role;

-- Only the verified admin Edge Function may request platform aggregates.
create or replace function public.taskboard_admin_metrics()
returns jsonb language sql stable security invoker set search_path = '' as $$
select jsonb_build_object(
 'teams',(select count(*) from public.taskboard_teams),
 'sharedProjects',(select count(*) from public.taskboard_shared_projects),
 'pendingInvitations',(select count(*) from public.taskboard_team_invitations where accepted_at is null and expires_at>now()),
 'expiredInvitations',(select count(*) from public.taskboard_team_invitations where accepted_at is null and expires_at<=now()),
 'acceptedInvitations',(select count(*) from public.taskboard_team_invitations where accepted_at is not null)
);
$$;
revoke all on function public.taskboard_admin_metrics() from public,anon,authenticated;
grant execute on function public.taskboard_admin_metrics() to service_role;

-- No implicit administrator exists after structural installation.
revoke all on maat_private.admin_members,maat_private.admin_control,maat_private.admin_access_events
 from public,anon,authenticated,service_role;
revoke all on function maat_private.admin_email_protection() from public,anon,authenticated,service_role;
create policy account_active_required on public.taskboard_workspaces as restrictive for all to authenticated
 using ((select public.taskboard_account_active())) with check ((select public.taskboard_account_active()));
-- These definer entrypoints must reject before touching any rows.
do $$declare f regprocedure;definition text;begin
 foreach f in array array['maat_private.save_workspace(uuid,bigint,jsonb)'::regprocedure,
 'maat_private.progress_taskboard_work(uuid,boolean,text)'::regprocedure] loop
  definition:=pg_get_functiondef(f);
  if strpos(definition,'if not public.taskboard_account_active()')>0 then raise exception 'Already guarded entrypoint';end if;
  definition:=regexp_replace(definition,'\mbegin\M',E'begin\n if not public.taskboard_account_active() then raise exception ''Account unavailable'' using errcode=''42501''; end if;','i');
  execute definition;
 end loop;
end$$;


-- Stage: calendar-guards
-- Local candidate only: no purge worker, email worker or administrator bootstrap.

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
