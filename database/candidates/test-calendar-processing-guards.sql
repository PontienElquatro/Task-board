-- All synthetic fixtures are rolled back. No remote service or purge.
begin;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000131','calendar-rehearsal@example.invalid');
insert into public.taskboard_teams(id,owner_id,name) values
 ('10000000-0000-4000-8000-000000000131','00000000-0000-4000-8000-000000000131','Calendar rehearsal');
insert into public.taskboard_shared_projects(id,team_id,title) values
 ('20000000-0000-4000-8000-000000000131','10000000-0000-4000-8000-000000000131','Calendar');
insert into public.taskboard_shared_tasks(project_id,team_id,title,start_date,end_date) values
 ('20000000-0000-4000-8000-000000000131','10000000-0000-4000-8000-000000000131','Dates','2026-10-15','2026-10-15');
do $$declare denied boolean:=false;begin
 begin
  update public.taskboard_shared_tasks set end_date='2026-10-14';
 exception when check_violation then denied:=true;end;
 if not denied then raise exception 'Reversed dates accepted';end if;
end$$;
update public.taskboard_shared_tasks set end_date=null;
insert into public.taskboard_account_deletions(user_id,requested_at,delete_after,status)
 values('00000000-0000-4000-8000-000000000131',now(),now()+interval '720 hours','processing');
do $$declare denied boolean:=false;begin
 begin
  update public.taskboard_teams set owner_id=owner_id;
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Processing owner accepted';end if;
 denied:=false;
 begin
  insert into public.taskboard_admin_allowlist(email) values('calendar-rehearsal@example.invalid');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Processing administrator accepted';end if;
 if has_function_privilege('authenticated','maat_private.guard_processing_owner()','EXECUTE')
 or has_function_privilege('service_role','maat_private.guard_processing_admin()','EXECUTE') then
  raise exception 'Trigger functions exposed';end if;
end$$;
delete from public.taskboard_account_deletions;
update public.taskboard_teams set owner_id=owner_id;
rollback;
select 'PASS calendar and processing guards; fixtures rolled back';
