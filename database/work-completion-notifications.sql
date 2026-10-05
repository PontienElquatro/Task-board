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
