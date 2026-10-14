begin;
create function pg_temp.expect_denied(command text) returns boolean language plpgsql as $$
begin
 execute command;
 raise exception 'Expected denial: %',command;
exception when insufficient_privilege then return true;
end $$;
insert into public.taskboard_account_status(user_id,suspended) values('00000000-0000-4000-8000-000000000061',true) on conflict(user_id) do update set suspended=true;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000061',true);
do $$
begin
 if public.taskboard_account_active() then raise exception 'Suspended account unexpectedly active';end if;
 if (select count(*) from public.taskboard_workspaces)>0 then raise exception 'Suspended workspace leaked';end if;
 if (select count(*) from public.taskboard_shared_tasks)>0 then raise exception 'Suspended tasks leaked';end if;
 if (select count(*) from public.taskboard_team_roster())>0 then raise exception 'Suspended roster leaked';end if;
 if public.is_taskboard_team_member('0be58aab-8d63-4e8c-8199-d7caf8cecaf5') then raise exception 'Suspended membership allowed';end if;
 perform pg_temp.expect_denied($q$select public.save_taskboard_workspace_for_user('00000000-0000-4000-8000-000000000061',0,'{}')$q$);
 perform pg_temp.expect_denied($q$select public.progress_taskboard_work('00000000-0000-4000-8000-000000000001',false,'done')$q$);
 perform pg_temp.expect_denied($q$select public.accept_taskboard_team_invitation('00000000-0000-4000-8000-000000000001','test')$q$);
 perform pg_temp.expect_denied($q$select public.manage_taskboard_member('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000061','member')$q$);
 perform pg_temp.expect_denied($q$select public.cancel_taskboard_invitation('00000000-0000-4000-8000-000000000001')$q$);
 perform pg_temp.expect_denied($q$select public.taskboard_set_account_status('00000000-0000-4000-8000-000000000061','fake','00000000-0000-4000-8000-000000000062','fake',true,false,'Test impossible')$q$);
end $$;
reset role;
update public.taskboard_account_status set suspended=false where user_id='00000000-0000-4000-8000-000000000061';
set local role authenticated;
do $$begin if not public.taskboard_account_active() then raise exception 'Reactivation gate failed';end if;end$$;
reset role;
rollback;
select 'Suspension RLS/RPC and reactivation checks passed; all fixture changes rolled back' as result;
