-- Local assertions only. No user, task, preference or notification is changed.
begin;
do $$declare f regprocedure;column_name text;begin
 if has_table_privilege('anon','public.taskboard_notifications','SELECT')
 or has_table_privilege('authenticated','public.taskboard_notifications','INSERT')
 or has_table_privilege('authenticated','public.taskboard_notifications','DELETE')
 or has_table_privilege('authenticated','public.taskboard_notifications','TRUNCATE') then
  raise exception 'Notifications allow unauthorized table operations';end if;
 foreach column_name in array array['id','user_id','team_id','project_id','task_id','subtask_id','title','actor_name','actor_avatar_url','project_name','created_at'] loop
  if has_column_privilege('authenticated','public.taskboard_notifications',column_name,'UPDATE') then
   raise exception 'Notification immutable column writable: %',column_name;end if;
 end loop;
 if not has_column_privilege('authenticated','public.taskboard_notifications','read_at','UPDATE')
 or not has_column_privilege('authenticated','public.taskboard_notifications','dismissed_at','UPDATE') then
  raise exception 'Recipient state cannot be changed';end if;
 if has_table_privilege('authenticated','public.taskboard_shared_subtasks','TRUNCATE') then
  raise exception 'Subtasks allow truncate bypass';end if;
 foreach f in array array['public.notify_taskboard_assignment()'::regprocedure,
 'maat_private.notify_work_completion()'::regprocedure,'maat_private.enrich_notification()'::regprocedure] loop
  if has_function_privilege('authenticated',f,'EXECUTE') or has_function_privilege('anon',f,'EXECUTE') then
   raise exception 'Trigger function exposed as client RPC';end if;
 end loop;
 if (select prosecdef from pg_proc where oid='public.progress_taskboard_work(uuid,boolean,text)'::regprocedure)
 or has_function_privilege('anon','public.progress_taskboard_work(uuid,boolean,text)','EXECUTE') then
  raise exception 'Work progress public endpoint unsafe';end if;
 if (select c.column_default from information_schema.columns c where c.table_schema='public'
 and c.table_name='taskboard_notification_preferences' and c.column_name='email_assignments') is distinct from 'false' then
  raise exception 'Email preference must default off';end if;
 if to_regclass('maat_private.notification_email_outbox') is not null then
  raise exception 'Unexpected email outbox in internal-only stage';end if;
 if (select count(*) from pg_publication_tables where pubname='supabase_realtime' and schemaname='public')<>3 then
  raise exception 'Expected only three local published tables';end if;
end$$;
rollback;
select 'PASS notification client privileges, default email off and publication catalog';
