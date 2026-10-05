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
