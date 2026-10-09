-- INSERT/UPDATE realtime respects existing SELECT policies; no new grants.
do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='taskboard_shared_tasks') then
    alter publication supabase_realtime add table public.taskboard_shared_tasks;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='taskboard_shared_subtasks') then
    alter publication supabase_realtime add table public.taskboard_shared_subtasks;
  end if;
end $$;
