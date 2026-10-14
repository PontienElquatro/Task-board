begin;
do $$
declare tid uuid;owner uuid;worker uuid;pid uuid;parent uuid;sub uuid;n integer;
begin
 select t.id,t.owner_id,m.user_id into tid,owner,worker from public.taskboard_teams t join public.taskboard_team_members m on m.team_id=t.id and m.user_id<>t.owner_id limit 1;
 if tid is null then raise exception 'Requires a team with two members';end if;
 perform set_config('request.jwt.claim.sub',owner::text,true);
 insert into public.taskboard_shared_projects(team_id,title) values(tid,'__navigation_rollback__') returning id into pid;
 insert into public.taskboard_shared_tasks(project_id,team_id,title,assignee_id) values(pid,tid,'Parent',worker) returning id into parent;
 insert into public.taskboard_shared_subtasks(task_id,team_id,title,assignee_id) values(parent,tid,'Child',worker) returning id into sub;
 if not exists(select 1 from public.taskboard_notifications where project_id=pid and user_id=worker and subtask_id=sub) then raise exception 'Missing assignment subtask target';end if;
 perform set_config('request.jwt.claim.sub',worker::text,true);
 perform public.progress_taskboard_work(sub,true,'done');
 if not exists(select 1 from public.taskboard_notifications where project_id=pid and user_id=owner and subtask_id=sub) then raise exception 'Missing completion subtask target';end if;
 if not exists(select 1 from public.taskboard_notifications where project_id=pid and title='Tâche terminée : Parent' and subtask_id is null) then raise exception 'Parent target is incorrect';end if;
end;$$;
create temp table notification_actor as select user_id from public.taskboard_notifications where project_id in(select id from public.taskboard_shared_projects where title='__navigation_rollback__') limit 1;
grant select on notification_actor to authenticated;
select set_config('request.jwt.claim.sub',(select user_id::text from notification_actor),true);
set local role authenticated;
do $$ declare n integer;begin
 update public.taskboard_notifications set read_at=now() where user_id=(select user_id from notification_actor) and read_at is null and dismissed_at is null;
 get diagnostics n=row_count;if n<1 then raise exception 'Own mark read failed';end if;
 update public.taskboard_notifications set read_at=now() where user_id<>(select user_id from notification_actor);
 get diagnostics n=row_count;if n<>0 then raise exception 'Cross account update allowed';end if;
end;$$;
rollback;
select 'notification targets and recipient isolation passed; all changes rolled back' as result;
