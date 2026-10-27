-- Local disposable fixtures only; no persistent users or work.
begin;
create function pg_temp.expect_error(command text) returns void language plpgsql as $$
declare rejected boolean:=false;
begin begin execute command; exception when others then rejected:=true;end;
 if not rejected then raise exception 'Expected rejection: %',command;end if;
end $$;
create function pg_temp.assert_true(value boolean) returns void language plpgsql as $$begin if value is distinct from true then raise exception 'Assertion failed';end if;end $$;
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-000000000091','owner-settings@example.invalid',now()),
 ('00000000-0000-4000-8000-000000000092','member-settings@example.invalid',now()),
 ('00000000-0000-4000-8000-000000000093','viewer-settings@example.invalid',now()),
 ('00000000-0000-4000-8000-000000000094','outsider-settings@example.invalid',now());
insert into public.taskboard_teams(id,owner_id,name) values
 ('10000000-0000-4000-8000-000000000091','00000000-0000-4000-8000-000000000091','Settings fixture');
insert into public.taskboard_team_members(team_id,user_id,role) values
 ('10000000-0000-4000-8000-000000000091','00000000-0000-4000-8000-000000000092','member'),
 ('10000000-0000-4000-8000-000000000091','00000000-0000-4000-8000-000000000093','viewer');
insert into public.taskboard_shared_projects(id,team_id,title) values
 ('20000000-0000-4000-8000-000000000091','10000000-0000-4000-8000-000000000091','Fixture project');
insert into public.taskboard_shared_tasks(id,team_id,project_id,title,assignee_id) values
 ('40000000-0000-4000-8000-000000000091','10000000-0000-4000-8000-000000000091','20000000-0000-4000-8000-000000000091','Preserved work','00000000-0000-4000-8000-000000000092');
insert into public.taskboard_shared_subtasks(id,team_id,task_id,title,assignee_id) values
 ('50000000-0000-4000-8000-000000000091','10000000-0000-4000-8000-000000000091','40000000-0000-4000-8000-000000000091','Preserved subtask','00000000-0000-4000-8000-000000000092');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000094',true);
select pg_temp.assert_true((select count(*)=0 from public.taskboard_shared_projects));
select pg_temp.expect_error($q$select public.taskboard_team_settings('10000000-0000-4000-8000-000000000091','close',1)$q$);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000092',true);
select pg_temp.expect_error($q$select public.taskboard_project_settings('20000000-0000-4000-8000-000000000091','close',1)$q$);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000091',true);
select pg_temp.expect_error($q$select public.taskboard_team_settings('10000000-0000-4000-8000-000000000091','leave',1)$q$);
select public.taskboard_team_settings('10000000-0000-4000-8000-000000000091','save',1,'Renamed team','Team description');
select pg_temp.expect_error($q$select public.taskboard_team_settings('10000000-0000-4000-8000-000000000091','close',1)$q$);
select public.taskboard_project_settings('20000000-0000-4000-8000-000000000091','save',1,'Renamed project','Project description','restricted');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000092',true);
select pg_temp.assert_true((select count(*)=0 from public.taskboard_shared_tasks));
select pg_temp.expect_error($q$select public.progress_taskboard_work('40000000-0000-4000-8000-000000000091',false,'in-progress')$q$);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000091',true);
select public.taskboard_project_settings('20000000-0000-4000-8000-000000000091','member',2,null,null,null,'00000000-0000-4000-8000-000000000092','member');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000092',true);
select pg_temp.assert_true((select count(*)=1 from public.taskboard_shared_tasks));
update public.taskboard_shared_tasks set title='Saved by member' where id='40000000-0000-4000-8000-000000000091';
select pg_temp.assert_true((select title='Saved by member' from public.taskboard_shared_tasks where id='40000000-0000-4000-8000-000000000091'));
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000091',true);
select public.taskboard_project_settings('20000000-0000-4000-8000-000000000091','close',3);
select pg_temp.assert_true(not public.taskboard_project_access('20000000-0000-4000-8000-000000000091',true));
select pg_temp.expect_error($q$select public.progress_taskboard_work('40000000-0000-4000-8000-000000000091',false,'in-progress')$q$);
select pg_temp.expect_error($q$select public.progress_taskboard_work('50000000-0000-4000-8000-000000000091',true,'done')$q$);
select public.taskboard_project_settings('20000000-0000-4000-8000-000000000091','reopen',4);
select public.taskboard_team_settings('10000000-0000-4000-8000-000000000091','close',2);
select pg_temp.assert_true((select count(*)=1 from public.taskboard_shared_tasks));
select pg_temp.expect_error($q$select public.progress_taskboard_work('50000000-0000-4000-8000-000000000091',true,'done')$q$);
select pg_temp.expect_error($q$insert into public.taskboard_team_invitations(team_id,email,role,invited_by,token_hash) values('10000000-0000-4000-8000-000000000091','new-settings@example.invalid','member','00000000-0000-4000-8000-000000000091',repeat('s',72))$q$);
select pg_temp.expect_error($q$select public.taskboard_project_settings('20000000-0000-4000-8000-000000000091','save',5,'Forbidden','','team')$q$);
select pg_temp.expect_error($q$insert into public.taskboard_shared_projects(team_id,title) values('10000000-0000-4000-8000-000000000091','Forbidden')$q$);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000092',true);
select public.taskboard_team_settings('10000000-0000-4000-8000-000000000091','leave',3);
select pg_temp.assert_true((select count(*)=0 from public.taskboard_shared_tasks));
reset role;
select pg_temp.assert_true((select assignee_id is null from public.taskboard_shared_tasks where id='40000000-0000-4000-8000-000000000091'));
select pg_temp.assert_true((select assignee_id is null from public.taskboard_shared_subtasks where id='50000000-0000-4000-8000-000000000091'));
select pg_temp.assert_true((select count(*)=0 from public.taskboard_project_members where user_id='00000000-0000-4000-8000-000000000092'));
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000091',true);
select public.taskboard_team_settings('10000000-0000-4000-8000-000000000091','reopen',3);
-- A team viewer never gains editing rights from a project role.
select public.taskboard_project_settings('20000000-0000-4000-8000-000000000091','member',5,null,null,null,'00000000-0000-4000-8000-000000000093','member');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000093',true);
select pg_temp.assert_true(public.taskboard_project_access('20000000-0000-4000-8000-000000000091',false));
select pg_temp.assert_true(not public.taskboard_project_access('20000000-0000-4000-8000-000000000091',true));
select pg_temp.expect_error($q$select public.progress_taskboard_work('50000000-0000-4000-8000-000000000091',true,'done')$q$);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000091',true);
select public.taskboard_team_settings('10000000-0000-4000-8000-000000000091','transfer',4,null,null,'00000000-0000-4000-8000-000000000093');
select pg_temp.expect_error($q$select public.taskboard_team_settings('10000000-0000-4000-8000-000000000091','close',5)$q$);
select public.taskboard_team_settings('10000000-0000-4000-8000-000000000091','leave',5);
reset role;
select pg_temp.assert_true((select owner_id='00000000-0000-4000-8000-000000000093' from public.taskboard_teams where id='10000000-0000-4000-8000-000000000091'));
select pg_temp.assert_true((select count(*)=1 from public.taskboard_team_members where team_id='10000000-0000-4000-8000-000000000091' and role='owner'));
select pg_temp.assert_true((select count(*)=1 from public.taskboard_shared_tasks));
select pg_temp.assert_true((select count(*)=1 from public.taskboard_shared_subtasks));
set local role anon;
select pg_temp.expect_error($q$select public.taskboard_project_settings('20000000-0000-4000-8000-000000000091','close',5)$q$);
reset role;
rollback;
select 'PASS team/project settings: permissions, isolation, version checks, closure, transfer, leave and preserved work; fixtures rolled back';
