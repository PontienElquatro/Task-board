begin;
create temp table preference_test_ids(owner_id uuid, worker_id uuid);
do $$
declare tid uuid;owner_id uuid;worker_id uuid;pid uuid;task uuid;
begin
 select t.id,t.owner_id,m.user_id into tid,owner_id,worker_id
 from public.taskboard_teams t join public.taskboard_team_members m on m.team_id=t.id and m.user_id<>t.owner_id
 where not exists(select 1 from public.taskboard_account_status s where s.user_id in(t.owner_id,m.user_id) and s.suspended) limit 1;
 if tid is null then raise exception 'Requires an active team with two members';end if;
 insert into preference_test_ids values(owner_id,worker_id);
 insert into public.taskboard_notification_preferences(user_id,assignments,completions)
 values(worker_id,false,true),(owner_id,true,false)
 on conflict(user_id) do update set assignments=excluded.assignments,completions=excluded.completions;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 insert into public.taskboard_shared_projects(team_id,title) values(tid,'__preferences_rollback__') returning id into pid;
 insert into public.taskboard_shared_tasks(team_id,project_id,title,assignee_id) values(tid,pid,'Muted assignment',worker_id) returning id into task;
 if exists(select 1 from public.taskboard_notifications where project_id=pid) then raise exception 'Muted assignment delivered';end if;
 perform set_config('request.jwt.claim.sub',worker_id::text,true);
 perform public.progress_taskboard_work(task,false,'done');
 if exists(select 1 from public.taskboard_notifications where project_id=pid) then raise exception 'Muted completion delivered';end if;
 if not exists(select 1 from public.taskboard_shared_tasks where id=task and status='done') then raise exception 'Preference blocked work';end if;
 update public.taskboard_notification_preferences set assignments=true,completions=true where user_id in(owner_id,worker_id);
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 insert into public.taskboard_shared_tasks(team_id,project_id,title,assignee_id) values(tid,pid,'Enabled assignment',worker_id) returning id into task;
 if (select count(*) from public.taskboard_notifications where project_id=pid)<>1 then raise exception 'Assignment not restored';end if;
 perform set_config('request.jwt.claim.sub',worker_id::text,true);
 perform public.progress_taskboard_work(task,false,'done');
 if (select count(*) from public.taskboard_notifications where project_id=pid)<>2 then raise exception 'Completion not restored';end if;
end $$;
grant select on preference_test_ids to authenticated;
select set_config('request.jwt.claim.sub',(select owner_id::text from preference_test_ids),true);
set local role authenticated;
do $$
declare affected integer;
begin
 if (select count(*) from public.taskboard_notification_preferences)<>1 then raise exception 'Cross-account read';end if;
 update public.taskboard_notification_preferences set assignments=false where user_id=(select worker_id from preference_test_ids);
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Cross-account update';end if;
 begin
  insert into public.taskboard_notification_preferences(user_id) values((select worker_id from preference_test_ids));
  raise exception 'Cross-account insert';
 exception when insufficient_privilege then null;
 end;
 update public.taskboard_notification_preferences set assignments=false where user_id=(select owner_id from preference_test_ids);
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'Self update denied';end if;
end $$;
reset role;
do $$ begin
 if has_table_privilege('anon','public.taskboard_notification_preferences','SELECT') then raise exception 'Anon access';end if;
 if has_function_privilege('authenticated','public.notify_taskboard_assignment()','EXECUTE') then raise exception 'Trigger exposed as RPC';end if;
end $$;
rollback;
select 'Preferences, delivery, work progression and account isolation passed; all changes rolled back' as result;
