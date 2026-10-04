create or replace function public.taskboard_team_roster()
returns table(team_id uuid,user_id uuid,role text,display_name text)
language sql stable security definer set search_path='' as $$
select m.team_id,m.user_id,m.role,
coalesce(nullif(u.raw_user_meta_data->>'full_name',''),nullif(u.raw_user_meta_data->>'name',''),u.email)
from public.taskboard_team_members m join auth.users u on u.id=m.user_id
where auth.uid() is not null and public.is_taskboard_team_member(m.team_id);
$$;
revoke all on function public.taskboard_team_roster() from public,anon;
grant execute on function public.taskboard_team_roster() to authenticated;
create or replace function public.cancel_taskboard_invitation(invitation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
delete from public.taskboard_team_invitations i using public.taskboard_teams t
where i.id=invitation_id and i.team_id=t.id and t.owner_id=auth.uid() and i.accepted_at is null;
if not found then raise exception 'Annulation impossible : invitation acceptée ou accès refusé.'; end if;
end; $$;
revoke all on function public.cancel_taskboard_invitation(uuid) from public,anon;
grant execute on function public.cancel_taskboard_invitation(uuid) to authenticated;
