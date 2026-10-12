begin;
do $$
declare owner uuid; marker text:='directory-fixture-'||gen_random_uuid()::text; result jsonb;
begin
  select principal_id into owner from maat_private.admin_control where singleton;
  insert into public.taskboard_teams(id,name,owner_id,created_at)
  select gen_random_uuid(),marker||'-'||lpad(i::text,3,'0'),owner,now()-i*interval '1 minute' from generate_series(1,51) i;
  result:=public.taskboard_admin_team_directory(marker,2);
  if (result->>'total')::integer<>51 or jsonb_array_length(result->'teams')<>1 then raise exception 'Pagination failed'; end if;
  result:=public.taskboard_admin_team_directory(marker||'-051',1);
  if (result->>'total')::integer<>1 then raise exception 'Search was applied after pagination'; end if;
  insert into public.taskboard_teams(id,name,owner_id) values(gen_random_uuid(),marker||' % literal',owner);
  result:=public.taskboard_admin_team_directory(marker||' %',1);
  if (result->>'total')::integer<>1 then raise exception 'Literal wildcard failed'; end if;
  result:=public.taskboard_admin_team_directory(marker||'-no-match',1);
  if (result->>'total')::integer<>0 or result->'teams'<>'[]'::jsonb then raise exception 'Empty state failed'; end if;
  if has_function_privilege('authenticated','public.taskboard_admin_team_directory(text,integer)','execute') then raise exception 'Directory exposed to ordinary clients'; end if;
end;
$$;
rollback;
select 'Global search before pagination, literal wildcards, empty state and permissions passed; 52 fixture teams rolled back' as result;
