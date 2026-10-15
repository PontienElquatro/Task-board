-- LOCAL ONLY. Called by the loopback-only runner; every fixture is rolled back.
begin;
create function pg_temp.assert_true(value boolean,label text) returns void
language plpgsql as $$begin
 if value is distinct from true then raise exception 'FAIL %',label; end if;
 raise notice 'PASS %',label;
end$$;
create function pg_temp.expect_denied(command text) returns void
language plpgsql security invoker as $$declare denied boolean:=false;
begin
 begin execute command; exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Expected insufficient privilege'; end if;
end$$;
insert into auth.users(id) values
 ('00000000-0000-4000-8000-000000000071'),
 ('00000000-0000-4000-8000-000000000072'),
 ('00000000-0000-4000-8000-000000000073'),
 ('00000000-0000-4000-8000-000000000074'),
 ('00000000-0000-4000-8000-000000000075');
insert into public.taskboard_teams(id,owner_id,name) values
 ('10000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000071','Local team A'),
 ('10000000-0000-4000-8000-000000000075','00000000-0000-4000-8000-000000000075','Local team B');
select pg_temp.assert_true((select count(*)=2 from public.taskboard_team_members where role='owner'),'atomic owner membership');
insert into public.taskboard_team_members(team_id,user_id,role) values
 ('10000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000072','admin'),
 ('10000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000073','member'),
 ('10000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000074','viewer');
insert into public.taskboard_shared_projects(id,team_id,title) values
 ('20000000-0000-4000-8000-000000000071','10000000-0000-4000-8000-000000000071','Local project');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000075',true);
select pg_temp.assert_true(not public.is_taskboard_team_member('10000000-0000-4000-8000-000000000071'),'outsider membership denied');
select pg_temp.assert_true(not exists(select 1 from public.taskboard_shared_projects),'outsider projects hidden');
select pg_temp.assert_true((select count(*)=1 from public.taskboard_teams),'outsider sees own team only');
select pg_temp.expect_denied($q$insert into public.taskboard_team_members values('10000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000075','admin',now())$q$);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000074',true);
select pg_temp.assert_true(public.is_taskboard_team_member('10000000-0000-4000-8000-000000000071') and not public.taskboard_edit_team('10000000-0000-4000-8000-000000000071'),'viewer read-only helper');
do $$declare changed integer;begin
 update public.taskboard_shared_projects set title='forbidden'; get diagnostics changed=row_count;
 perform pg_temp.assert_true(changed=0,'viewer update filtered');
end$$;
select pg_temp.expect_denied($q$insert into public.taskboard_shared_tasks(project_id,team_id,title) values('20000000-0000-4000-8000-000000000071','10000000-0000-4000-8000-000000000071','forbidden')$q$);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000073',true);
select pg_temp.assert_true(public.taskboard_edit_team('10000000-0000-4000-8000-000000000071') and not public.taskboard_manage_team('10000000-0000-4000-8000-000000000071'),'member edit but no management');
insert into public.taskboard_shared_tasks(project_id,team_id,title) values
 ('20000000-0000-4000-8000-000000000071','10000000-0000-4000-8000-000000000071','allowed');
select pg_temp.assert_true((select count(*)=1 from public.taskboard_shared_tasks),'member task created');
select pg_temp.expect_denied($q$select public.accept_taskboard_team_invitation(gen_random_uuid(),'not-enabled')$q$);
select pg_temp.expect_denied('select * from public.taskboard_team_invitations');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000072',true);
select pg_temp.assert_true(public.taskboard_manage_team('10000000-0000-4000-8000-000000000071'),'admin management');
do $$declare denied boolean:=false;begin
 begin perform public.manage_taskboard_member('10000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000073','admin');
 exception when raise_exception then denied:=true; end;
 perform pg_temp.assert_true(denied,'admin cannot promote admin');
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000071',true);
select public.manage_taskboard_member('10000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000073',null);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000073',true);
select pg_temp.assert_true(not exists(select 1 from public.taskboard_shared_tasks),'revocation immediate');
set local role anon;
select pg_temp.expect_denied('select * from public.taskboard_shared_projects');
select pg_temp.expect_denied($q$select public.taskboard_manage_team(gen_random_uuid())$q$);
reset role;
select pg_temp.assert_true(not has_table_privilege('authenticated','public.taskboard_shared_tasks','TRUNCATE'),'no truncate bypass');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.taskboard_team_members','INSERT'),'membership writes unavailable');
select pg_temp.assert_true((select count(*)=5 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('is_taskboard_team_member','taskboard_manage_team','taskboard_edit_team','manage_taskboard_member','taskboard_team_roster')),'five expected wrappers');
do $$declare f record;begin
 for f in select p.oid,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('is_taskboard_team_member','taskboard_manage_team','taskboard_edit_team','manage_taskboard_member','taskboard_team_roster') loop
  perform pg_temp.assert_true(not f.prosecdef and not has_function_privilege('anon',f.oid,'EXECUTE'),'public wrapper is restricted invoker');
 end loop;
end$$;
rollback;
select 'PASS collaboration core; fixtures rolled back' as result;
