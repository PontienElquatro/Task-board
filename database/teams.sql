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
create policy teams_read_member on public.taskboard_teams for select to authenticated
using (owner_id = (select auth.uid()) or exists (select 1 from public.taskboard_team_members m where m.team_id = id and m.user_id = (select auth.uid())));
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
create policy members_read_member on public.taskboard_team_members for select to authenticated
using (user_id = (select auth.uid()) or exists (select 1 from public.taskboard_teams t where t.id = team_id and t.owner_id = (select auth.uid())));
drop policy if exists members_manage_admin on public.taskboard_team_members;
create policy members_manage_admin on public.taskboard_team_members for all to authenticated
using (exists (select 1 from public.taskboard_teams t where t.id = team_id and t.owner_id = (select auth.uid())));

drop policy if exists invitations_read_admin on public.taskboard_team_invitations;
create policy invitations_read_admin on public.taskboard_team_invitations for select to authenticated
using (invited_by = (select auth.uid()) or exists (select 1 from public.taskboard_teams t where t.id = team_id and t.owner_id = (select auth.uid())));
drop policy if exists invitations_create_admin on public.taskboard_team_invitations;
create policy invitations_create_admin on public.taskboard_team_invitations for insert to authenticated
with check (invited_by = (select auth.uid()) and exists (select 1 from public.taskboard_teams t where t.id = team_id and t.owner_id = (select auth.uid())));
drop policy if exists invitations_update_admin on public.taskboard_team_invitations;
create policy invitations_update_admin on public.taskboard_team_invitations for update to authenticated
using (invited_by = (select auth.uid())) with check (invited_by = (select auth.uid()));
