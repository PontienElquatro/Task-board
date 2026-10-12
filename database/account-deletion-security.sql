-- Prevent stale JWTs and processing accounts from using the application.
-- Apply after account-deletion.sql and account-security.sql on TEST first.
create or replace function maat_private.account_can_operate()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
 and exists(select 1 from auth.users u where u.id=auth.uid())
 and not exists(select 1 from public.taskboard_account_status s where s.user_id=auth.uid() and s.suspended)
 and not exists(select 1 from public.taskboard_account_deletions d where d.user_id=auth.uid() and d.status='processing');
$$;
revoke all on function maat_private.account_can_operate() from public,anon;
grant execute on function maat_private.account_can_operate() to authenticated,service_role;

create or replace function public.taskboard_account_active()
returns boolean language sql stable security invoker set search_path='' as $$
 select maat_private.account_can_operate();
$$;
revoke all on function public.taskboard_account_active() from public,anon;
grant execute on function public.taskboard_account_active() to authenticated,service_role;
