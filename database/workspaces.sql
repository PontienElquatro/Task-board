-- Private, versioned personal workspaces. No anonymous access.
create table public.taskboard_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 5242880),
  updated_at timestamptz not null default now()
);
alter table public.taskboard_workspaces enable row level security;
revoke all on public.taskboard_workspaces from anon, authenticated;
grant select, insert, update on public.taskboard_workspaces to authenticated;
create policy workspace_read on public.taskboard_workspaces for select to authenticated using ((select auth.uid()) = user_id);
create policy workspace_insert on public.taskboard_workspaces for insert to authenticated with check ((select auth.uid()) = user_id);
create policy workspace_update on public.taskboard_workspaces for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Atomic compare-and-swap: the expected revision prevents lost updates.
create function public.save_taskboard_workspace(expected_revision bigint, workspace_data jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare result bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if jsonb_typeof(workspace_data) <> 'object' or octet_length(workspace_data::text) > 5242880 then
    raise exception 'Invalid workspace' using errcode = '22023';
  end if;
  if expected_revision = 0 then
    insert into public.taskboard_workspaces(user_id, data) values (auth.uid(), workspace_data)
      on conflict (user_id) do nothing returning revision into result;
  else
    update public.taskboard_workspaces set data = workspace_data, revision = revision + 1, updated_at = now()
      where user_id = auth.uid() and revision = expected_revision returning revision into result;
  end if;
  if result is null then raise exception 'Workspace changed on another device' using errcode = 'PT409'; end if;
  return result;
end;
$$;
revoke all on function public.save_taskboard_workspace(bigint,jsonb) from public, anon;
grant execute on function public.save_taskboard_workspace(bigint,jsonb) to authenticated;

-- Account-bound CAS: prevents a session switch from writing into a different account.
create function public.save_taskboard_workspace_for_user(workspace_user uuid, expected_revision bigint, workspace_data jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare result bigint;
begin
  if auth.uid() is null or auth.uid() <> workspace_user then raise exception 'Account mismatch' using errcode = '42501'; end if;
  if workspace_data is null or jsonb_typeof(workspace_data) <> 'object' or octet_length(workspace_data::text) > 5242880 then
    raise exception 'Invalid workspace' using errcode = '22023';
  end if;
  if expected_revision = 0 then
    insert into public.taskboard_workspaces(user_id, data) values (workspace_user, workspace_data)
      on conflict (user_id) do nothing returning revision into result;
  else
    update public.taskboard_workspaces set data = workspace_data, revision = revision + 1, updated_at = now()
      where user_id = workspace_user and revision = expected_revision returning revision into result;
  end if;
  if result is null then raise exception 'Workspace changed on another device' using errcode = 'PT409'; end if;
  return result;
end;
$$;
revoke all on function public.save_taskboard_workspace_for_user(uuid,bigint,jsonb) from public, anon;
grant execute on function public.save_taskboard_workspace_for_user(uuid,bigint,jsonb) to authenticated;
revoke execute on function public.save_taskboard_workspace(bigint,jsonb) from authenticated;
