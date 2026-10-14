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

