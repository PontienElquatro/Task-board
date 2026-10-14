-- Admin permissions are managed only by the backend/project owner.
create table public.taskboard_admin_allowlist (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.taskboard_admin_allowlist enable row level security;
revoke all on public.taskboard_admin_allowlist from public, anon, authenticated;
grant select on public.taskboard_admin_allowlist to service_role;
create table public.taskboard_admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action = 'dashboard_view'),
  created_at timestamptz not null default now()
);
create index admin_audit_created on public.taskboard_admin_audit (created_at desc);
create index admin_audit_actor_created on public.taskboard_admin_audit (actor_id, created_at desc);
alter table public.taskboard_admin_audit enable row level security;
revoke all on public.taskboard_admin_audit from public, anon, authenticated;
grant select, insert on public.taskboard_admin_audit to service_role;
grant usage, select on sequence public.taskboard_admin_audit_id_seq to service_role;
create policy admin_allowlist_deny_client on public.taskboard_admin_allowlist for all to anon, authenticated using (false) with check (false);
create policy admin_audit_deny_client on public.taskboard_admin_audit for all to anon, authenticated using (false) with check (false);
