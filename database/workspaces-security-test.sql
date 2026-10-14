-- Run ONLY on Maat-test with the two fixture auth.users created by the test operator.
-- Transaction rolls back all workspace changes; fixtures have no passwords/sessions.
begin;
create function pg_temp.expect_error(command text, expected text) returns text language plpgsql security invoker as $$
declare received text;
begin
  begin execute command;
  exception when others then get stacked diagnostics received=returned_sqlstate;
  end;
  if received is distinct from expected then raise exception 'Expected %, received % for %',expected,received,command; end if;
  return 'PASS ' || expected;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000061","role":"authenticated"}',true);
select public.save_taskboard_workspace_for_user('00000000-0000-4000-8000-000000000061',0,'{"fixture":"a"}') as first_revision;
select public.save_taskboard_workspace_for_user('00000000-0000-4000-8000-000000000061',1,'{"fixture":"a-updated"}') as second_revision;
do $$begin
  if (select count(*) from public.taskboard_workspaces)<>1 then raise exception 'Own workspace must be visible'; end if;
  if (select revision from public.taskboard_workspaces)<>2 then raise exception 'Revision must increment'; end if;
end$$;
select pg_temp.expect_error($q$select public.save_taskboard_workspace_for_user('00000000-0000-4000-8000-000000000061',1,'{}')$q$,'PT409') as stale_revision;
select pg_temp.expect_error($q$select public.save_taskboard_workspace_for_user('00000000-0000-4000-8000-000000000061',0,'{}')$q$,'PT409') as duplicate_create;
select pg_temp.expect_error($q$select public.save_taskboard_workspace_for_user('00000000-0000-4000-8000-000000000062',0,'{}')$q$,'42501') as other_account_write;
select pg_temp.expect_error($q$update public.taskboard_workspaces set data='{}'$q$,'42501') as direct_update;
select pg_temp.expect_error($q$insert into public.taskboard_workspaces(user_id) values('00000000-0000-4000-8000-000000000061')$q$,'42501') as direct_insert;
select pg_temp.expect_error($q$delete from public.taskboard_workspaces$q$,'42501') as direct_delete;
select pg_temp.expect_error($q$select * from public.taskboard_admin_allowlist$q$,'42501') as admin_allowlist;
select pg_temp.expect_error($q$select * from public.taskboard_admin_audit$q$,'42501') as admin_audit;
select pg_temp.expect_error($q$select public.save_taskboard_workspace(2,'{}')$q$,'42501') as legacy_endpoint;
select pg_temp.expect_error($q$select public.save_taskboard_workspace_for_user(null,2,'{}')$q$,'42501') as null_account;
select pg_temp.expect_error($q$select public.save_taskboard_workspace_for_user('00000000-0000-4000-8000-000000000061',-1,'{}')$q$,'22023') as negative_revision;
select pg_temp.expect_error($q$select public.save_taskboard_workspace_for_user('00000000-0000-4000-8000-000000000061',null,'{}')$q$,'22023') as null_revision;
select pg_temp.expect_error($q$select public.save_taskboard_workspace_for_user('00000000-0000-4000-8000-000000000061',2,null)$q$,'22023') as null_payload;
select pg_temp.expect_error($q$select public.save_taskboard_workspace_for_user('00000000-0000-4000-8000-000000000061',2,'[]')$q$,'22023') as array_payload;
select pg_temp.expect_error($q$select public.save_taskboard_workspace_for_user('00000000-0000-4000-8000-000000000061',2,jsonb_build_object('large',repeat('x',5242881)))$q$,'22023') as oversized_payload;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000062","role":"authenticated"}',true);
do $$begin if exists(select 1 from public.taskboard_workspaces) then raise exception 'Account B can see A'; end if; end$$;
select public.save_taskboard_workspace_for_user('00000000-0000-4000-8000-000000000062',0,'{"fixture":"b"}') as account_b_revision;
do $$begin if (select count(*) from public.taskboard_workspaces)<>1 then raise exception 'Account B must see only its own row'; end if; end$$;
select pg_temp.expect_error($q$select public.save_taskboard_workspace_for_user('00000000-0000-4000-8000-000000000061',2,'{}')$q$,'42501') as reverse_account_write;
select set_config('request.jwt.claims','{}',true);
select pg_temp.expect_error($q$select public.save_taskboard_workspace_for_user('00000000-0000-4000-8000-000000000061',2,'{}')$q$,'42501') as missing_identity;
set local role anon;
select pg_temp.expect_error($q$select * from public.taskboard_workspaces$q$,'42501') as anonymous_read;
select pg_temp.expect_error($q$select public.save_taskboard_workspace_for_user('00000000-0000-4000-8000-000000000061',2,'{}')$q$,'42501') as anonymous_rpc;
rollback;
