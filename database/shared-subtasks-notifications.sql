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
