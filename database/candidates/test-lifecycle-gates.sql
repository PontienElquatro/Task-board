-- Local rollback-only tests. Nothing executes a purge.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-000000000121','gate-rehearsal@example.invalid',now());
insert into public.taskboard_account_deletions(user_id,requested_at,delete_after,status)
 values('00000000-0000-4000-8000-000000000121',now(),now()+interval '720 hours','processing');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000121',true);
do $$declare denied boolean:=false;begin
 if public.taskboard_account_active() then raise exception 'Processing account active';end if;
 begin perform public.save_taskboard_workspace_for_user('00000000-0000-4000-8000-000000000121',0,'{}');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Processing account saved workspace';end if;
end$$;
reset role;
delete from public.taskboard_account_deletions;
delete from auth.users where id='00000000-0000-4000-8000-000000000121';
set local role authenticated;
do $$begin if public.taskboard_account_active() then raise exception 'Deleted identity still active';end if;end$$;
reset role;
do $$begin
 if exists(select 1 from maat_private.account_deletion_config where enabled or execution_enabled) then raise exception 'Deletion accidentally enabled';end if;
 if exists(select 1 from maat_private.admin_members) or exists(select 1 from maat_private.admin_control) then raise exception 'Unexpected persistent principal';end if;
 if has_table_privilege('service_role','maat_private.account_deletion_config','UPDATE') then raise exception 'Service can enable purge';end if;
 if has_function_privilege('authenticated','public.taskboard_admin_access(uuid,uuid,text,uuid,text[],integer,text)','EXECUTE') then raise exception 'Admin RPC exposed';end if;
 if to_regprocedure('public.taskboard_claim_account_deletions_v2(integer)') is not null then raise exception 'Unexpected claim worker';end if;
end$$;
rollback;
select 'PASS lifecycle gates and no persistent administrator or purge worker';
