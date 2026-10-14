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
