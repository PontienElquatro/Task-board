-- Read-only assertions: no notification or task is changed.
begin;
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='taskboard_notifications') then raise exception 'Missing publication';end if;
 if not (select relrowsecurity from pg_class where oid='public.taskboard_notifications'::regclass) then raise exception 'Missing RLS';end if;
 if has_column_privilege('authenticated','public.taskboard_notifications','actor_name','UPDATE')
 or has_column_privilege('authenticated','public.taskboard_notifications','title','UPDATE')
 or not has_column_privilege('authenticated','public.taskboard_notifications','read_at','UPDATE')
 then raise exception 'Incorrect update privileges';end if;
 if has_function_privilege('authenticated','maat_private.enrich_notification()','EXECUTE')
 or has_function_privilege('anon','maat_private.enrich_notification()','EXECUTE')
 then raise exception 'Trigger function exposed';end if;
end $$;
rollback;
