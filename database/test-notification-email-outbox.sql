-- Rollback-only: no network, worker or actual email, even when the test gate is true.
begin;
create temp table email_test_ids(owner_id uuid,worker_id uuid);
do $$
declare tid uuid; owner_id uuid; worker_id uuid; pid uuid; task uuid; subtask uuid; revision uuid; count_before integer;
begin
 if (select enabled from maat_private.notification_email_config where singleton) then raise exception 'Email gate must start disabled';end if;
 select t.id,t.owner_id,m.user_id into tid,owner_id,worker_id
 from public.taskboard_teams t join public.taskboard_team_members m on m.team_id=t.id and m.user_id<>t.owner_id
 join auth.users u on u.id=m.user_id and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now())
 where not exists(select 1 from public.taskboard_account_status s where s.user_id in(t.owner_id,m.user_id) and s.suspended)
 and not exists(select 1 from public.taskboard_account_deletions d where d.user_id in(t.owner_id,m.user_id) and d.status='processing') limit 1;
 if tid is null then raise exception 'Requires an active team with two confirmed members';end if;
 insert into email_test_ids values(owner_id,worker_id);
 insert into public.taskboard_notification_preferences(user_id,assignments,completions,email_assignments)
 values(worker_id,false,true,true),(owner_id,true,true,true)
 on conflict(user_id) do update set assignments=excluded.assignments,completions=excluded.completions,email_assignments=excluded.email_assignments;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 insert into public.taskboard_shared_projects(team_id,title) values(tid,'__email_rollback__') returning id into pid;
 insert into public.taskboard_shared_tasks(team_id,project_id,title,assignee_id) values(tid,pid,'Gate disabled',worker_id) returning id into task;
 if exists(select 1 from maat_private.notification_email_outbox where task_id=task) then raise exception 'Disabled gate queued email';end if;

 -- This switch changes only in this rolled-back transaction, with no worker deployed.
 update maat_private.notification_email_config set enabled=true where singleton;
 insert into public.taskboard_shared_tasks(team_id,project_id,title,assignee_id) values(tid,pid,'Email independent of bell',worker_id) returning id,email_assignment_version into task,revision;
 if (select count(*) from maat_private.notification_email_outbox where task_id=task and status='pending')<>1 then raise exception 'Email missing with bell off';end if;
 if exists(select 1 from public.taskboard_notifications where task_id=task) then raise exception 'Bell preference ignored';end if;
 update public.taskboard_shared_tasks set assignee_id=worker_id,email_assignment_version=gen_random_uuid(),title='Edited' where id=task;
 if (select email_assignment_version from public.taskboard_shared_tasks where id=task)<>revision then raise exception 'Event revision spoofable';end if;
 if (select count(*) from maat_private.notification_email_outbox where task_id=task)<>1 then raise exception 'Duplicate assignment';end if;
 insert into public.taskboard_shared_subtasks(task_id,team_id,title,assignee_id) values(task,tid,'Subtask',worker_id) returning id into subtask;
 if (select count(*) from maat_private.notification_email_outbox where subtask_id=subtask and status='pending')<>1 then raise exception 'Subtask missing';end if;
 update public.taskboard_shared_tasks set assignee_id=null where id=task;
 if exists(select 1 from maat_private.notification_email_outbox where task_id=task and status='pending') then raise exception 'Stale event not suppressed';end if;
 update public.taskboard_shared_tasks set assignee_id=worker_id where id=task;
 if (select count(*) from maat_private.notification_email_outbox where task_id=task)<>2 then raise exception 'Reassignment missing';end if;
 if (select email_assignment_version from public.taskboard_shared_tasks where id=task)=revision then raise exception 'Reassignment reused revision';end if;
 update public.taskboard_notification_preferences set email_assignments=false where user_id=worker_id;
 if exists(select 1 from maat_private.notification_email_outbox where user_id=worker_id and status='pending') then raise exception 'Opt-out did not cancel pending events';end if;
 insert into public.taskboard_shared_tasks(team_id,project_id,title,assignee_id) values(tid,pid,'Opted out',worker_id) returning id into task;
 if exists(select 1 from maat_private.notification_email_outbox where task_id=task) then raise exception 'Opt-out ignored';end if;
 insert into public.taskboard_shared_tasks(team_id,project_id,title,assignee_id) values(tid,pid,'Self assignment',owner_id) returning id into task;
 if exists(select 1 from maat_private.notification_email_outbox where task_id=task) then raise exception 'Self assignment queued';end if;
 update public.taskboard_notification_preferences set email_assignments=true where user_id=worker_id;
 insert into public.taskboard_account_status(user_id,suspended) values(worker_id,true)
 on conflict(user_id) do update set suspended=true;
 insert into public.taskboard_shared_tasks(team_id,project_id,title,assignee_id) values(tid,pid,'Suspended recipient',worker_id) returning id into task;
 if exists(select 1 from maat_private.notification_email_outbox where task_id=task) then raise exception 'Suspended recipient queued';end if;
 update public.taskboard_account_status set suspended=false where user_id=worker_id;
 select count(*) into count_before from maat_private.notification_email_outbox;
 delete from public.taskboard_shared_projects where id=pid;
 if (select count(*) from maat_private.notification_email_outbox)>=count_before then raise exception 'Deleted work retains queue';end if;
 update maat_private.notification_email_config set enabled=false where singleton;
end;$$;
grant select on email_test_ids to authenticated;
select set_config('request.jwt.claim.sub',(select owner_id::text from email_test_ids),true);
set local role authenticated;
do $$
declare affected integer;
begin
 update public.taskboard_notification_preferences set email_assignments=true where user_id=(select worker_id from email_test_ids);
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Cross-account email preference update';end if;
 update public.taskboard_notification_preferences set email_assignments=false where user_id=(select owner_id from email_test_ids);
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'Self preference denied';end if;
 if (select count(*) from public.taskboard_notification_preferences)<>1 then raise exception 'Cross-account preference read';end if;
end;$$;
reset role;
do $$
begin
 if has_table_privilege('authenticated','maat_private.notification_email_outbox','SELECT')
 or has_table_privilege('anon','maat_private.notification_email_outbox','INSERT')
 or has_table_privilege('service_role','maat_private.notification_email_config','UPDATE')
 or has_function_privilege('authenticated','maat_private.queue_assignment_email()','EXECUTE')
 then raise exception 'Private queue or activation gate exposed';end if;
end;$$;
rollback;
select 'Email gate, opt-in, independent bell, deduplication, reassignment, opt-out, suspension, cleanup and account isolation passed; rolled back' as result;
