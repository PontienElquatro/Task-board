-- Candidate for Maat-test only; not a published production migration.
begin;
create role maat_workspace_writer nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant maat_workspace_writer to postgres;
-- Supabase controls auth schema grants. Inherit only the standard client role,
-- whose table writes are revoked below, to use its Auth helpers.
grant authenticated to maat_workspace_writer;
create schema maat_private;
revoke all on schema maat_private from public, anon, authenticated;
grant usage on schema maat_private to authenticated, maat_workspace_writer;
grant usage on schema public to maat_workspace_writer;
grant execute on function auth.uid() to maat_workspace_writer;
revoke all on public.taskboard_workspaces from public, anon, authenticated;
grant select on public.taskboard_workspaces to authenticated;
grant select, insert, update on public.taskboard_workspaces to maat_workspace_writer;
create policy workspace_writer_read on public.taskboard_workspaces for select to maat_workspace_writer using ((select auth.uid())=user_id);
create policy workspace_writer_insert on public.taskboard_workspaces for insert to maat_workspace_writer with check ((select auth.uid())=user_id);
create policy workspace_writer_update on public.taskboard_workspaces for update to maat_workspace_writer using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create function maat_private.save_workspace(workspace_user uuid, expected_revision bigint, workspace_data jsonb)
returns bigint language plpgsql security definer set search_path='' as $$
declare result bigint;
begin
  if auth.uid() is null or workspace_user is null or auth.uid() is distinct from workspace_user then raise exception 'Account mismatch' using errcode='42501'; end if;
  if expected_revision is null or expected_revision<0 or expected_revision=9223372036854775807 then raise exception 'Invalid revision' using errcode='22023'; end if;
  if workspace_data is null or jsonb_typeof(workspace_data)<>'object' or octet_length(workspace_data::text)>5242880 then raise exception 'Invalid workspace' using errcode='22023'; end if;
  if expected_revision=0 then
    insert into public.taskboard_workspaces(user_id,data) values(workspace_user,workspace_data) on conflict(user_id) do nothing returning revision into result;
  else
    update public.taskboard_workspaces set data=workspace_data,revision=revision+1,updated_at=now() where user_id=workspace_user and revision=expected_revision returning revision into result;
  end if;
  -- Business conflict, not serialization_failure (40001 triggers retries in PostgREST 14).
  if result is null then raise exception 'Workspace changed on another device' using errcode='PT409'; end if;
  return result;
end;
$$;
-- The owner neither owns the table nor bypasses RLS.
grant create on schema maat_private to maat_workspace_writer;
alter function maat_private.save_workspace(uuid,bigint,jsonb) owner to maat_workspace_writer;
revoke create on schema maat_private from maat_workspace_writer;
revoke all on function maat_private.save_workspace(uuid,bigint,jsonb) from public, anon, authenticated;
grant execute on function maat_private.save_workspace(uuid,bigint,jsonb) to authenticated;
create or replace function public.save_taskboard_workspace_for_user(workspace_user uuid, expected_revision bigint, workspace_data jsonb)
returns bigint language sql security invoker set search_path='' as $$ select maat_private.save_workspace(workspace_user,expected_revision,workspace_data); $$;
revoke all on function public.save_taskboard_workspace_for_user(uuid,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.save_taskboard_workspace_for_user(uuid,bigint,jsonb) to authenticated;
revoke all on function public.save_taskboard_workspace(bigint,jsonb) from public, anon, authenticated;
commit;
