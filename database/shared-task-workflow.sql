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
