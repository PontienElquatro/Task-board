-- Disposable fixtures; all Auth/workspace/status writes roll back.
begin;
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (a,'sync-a-'||a||'@example.invalid',now()),(b,'sync-b-'||b||'@example.invalid',now());
 perform set_config('maat.sync_a',a::text,true);perform set_config('maat.sync_b',b::text,true);
end $$;
set local role authenticated;
do $$
declare a uuid:=current_setting('maat.sync_a')::uuid;b uuid:=current_setting('maat.sync_b')::uuid;
 revision bigint;denied boolean;
begin
 perform set_config('request.jwt.claim.sub',a::text,true);
 revision:=public.save_taskboard_workspace_for_user(a,0,'{"mytaskboard_tasks":[{"id":"task","title":"original"}]}'::jsonb);
 if revision<>1 then raise exception 'Initial revision mismatch'; end if;
 revision:=public.save_taskboard_workspace_for_user(a,1,'{"mytaskboard_tasks":[{"id":"task","title":"new"}]}'::jsonb);
 if revision<>2 then raise exception 'Revision did not increment'; end if;
 denied:=false;begin perform public.save_taskboard_workspace_for_user(a,1,'{}');exception when sqlstate 'PT409' then denied:=true;end;
 if not denied then raise exception 'Stale revision overwrote current data';end if;
 if (select data->'mytaskboard_tasks'->0->>'title' from public.taskboard_workspaces where user_id=a)<>'new' then raise exception 'Conflict lost saved content';end if;
 denied:=false;begin perform public.save_taskboard_workspace_for_user(a,0,'{}');exception when sqlstate 'PT409' then denied:=true;end;
 if not denied then raise exception 'Duplicate creation replaced existing data';end if;
 denied:=false;begin perform public.save_taskboard_workspace_for_user(b,0,'{}');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Cross-account write succeeded';end if;
 denied:=false;begin perform public.save_taskboard_workspace_for_user(a,null,'{}');exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Invalid revision accepted';end if;
 denied:=false;begin perform public.save_taskboard_workspace_for_user(a,2,'[]');exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'Array payload accepted';end if;
 denied:=false;begin update public.taskboard_workspaces set data='{}' where user_id=a;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Direct update bypassed CAS';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 if exists(select 1 from public.taskboard_workspaces where user_id=a) then raise exception 'Cross-account read leak';end if;
 perform public.save_taskboard_workspace_for_user(b,0,'{"mytaskboard_tasks":[]}'::jsonb);
end $$;
reset role;
insert into public.taskboard_account_status(user_id,suspended) values(current_setting('maat.sync_a')::uuid,true);
set local role authenticated;
do $$
declare denied boolean:=false;
begin
 perform set_config('request.jwt.claim.sub',current_setting('maat.sync_a'),true);
 begin perform public.save_taskboard_workspace_for_user(current_setting('maat.sync_a')::uuid,2,'{}');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Suspended account wrote workspace';end if;
end $$;
set local role anon;
do $$
declare denied boolean:=false;
begin
 begin perform public.save_taskboard_workspace_for_user(current_setting('maat.sync_a')::uuid,2,'{}');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Anonymous RPC access';end if;
end $$;
rollback;
select 'CAS conflicts, retained data, account isolation, payload validation, suspension and anonymous access passed; fixtures rolled back' as result;
