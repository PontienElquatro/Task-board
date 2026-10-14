-- Only the verified admin Edge Function may request platform aggregates.
create or replace function public.taskboard_admin_metrics()
returns jsonb language sql stable security invoker set search_path = '' as $$
select jsonb_build_object(
 'teams',(select count(*) from public.taskboard_teams),
 'sharedProjects',(select count(*) from public.taskboard_shared_projects),
 'pendingInvitations',(select count(*) from public.taskboard_team_invitations where accepted_at is null and expires_at>now()),
 'expiredInvitations',(select count(*) from public.taskboard_team_invitations where accepted_at is null and expires_at<=now()),
 'acceptedInvitations',(select count(*) from public.taskboard_team_invitations where accepted_at is not null)
);
$$;
revoke all on function public.taskboard_admin_metrics() from public,anon,authenticated;
grant execute on function public.taskboard_admin_metrics() to service_role;
