begin;
do $$
declare actor uuid; session uuid:=gen_random_uuid(); version integer; updated jsonb;
begin
  select principal_id into actor from maat_private.admin_control where singleton;
  insert into auth.sessions(id,user_id,created_at,updated_at) values(session,actor,now(),now());
  select s.version into version from public.taskboard_platform_settings s where singleton;
  updated:=public.taskboard_update_platform_settings(actor,session,'support@example.invalid','Rollback announcement',version,'Rollback settings fixture');
  if updated->>'announcement'<>'Rollback announcement' then raise exception 'Settings not persisted'; end if;
  begin
    perform public.taskboard_update_platform_settings(actor,session,'','',version,'Concurrent change fixture');
    raise exception 'Concurrent overwrite accepted';
  exception when sqlstate 'PT409' then null; end;
  if has_table_privilege('authenticated','public.taskboard_platform_settings','UPDATE') then raise exception 'Client can write'; end if;
  if has_function_privilege('anon','public.taskboard_update_platform_settings(uuid,uuid,text,text,integer,text)','EXECUTE') then raise exception 'Public write RPC exposed'; end if;
end;
$$;
rollback;
select 'Public settings persistence, concurrency and client write protection passed; all changes rolled back' as result;
