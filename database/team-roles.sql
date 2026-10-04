create or replace function public.taskboard_manage_team(tid uuid)
returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null and exists(select 1 from public.taskboard_teams t where t.id=tid and (t.owner_id=auth.uid() or exists(select 1 from public.taskboard_team_members m where m.team_id=t.id and m.user_id=auth.uid() and m.role='admin')));
$$;
revoke all on function public.taskboard_manage_team(uuid) from public,anon;
grant execute on function public.taskboard_manage_team(uuid) to authenticated;
create or replace function public.manage_taskboard_member(tid uuid, member_id uuid, new_role text)
returns void language plpgsql security definer set search_path='' as $$
declare owner_id uuid; target_role text; actor_role text;
begin
select t.owner_id into owner_id from public.taskboard_teams t where t.id=tid for update;
if not found or auth.uid() is null then raise exception 'Accès refusé.'; end if;
select m.role into actor_role from public.taskboard_team_members m where m.team_id=tid and m.user_id=auth.uid();
select m.role into target_role from public.taskboard_team_members m where m.team_id=tid and m.user_id=member_id;
if target_role is null then raise exception 'Membre introuvable.'; end if;
if member_id=owner_id or target_role='owner' then raise exception 'Le propriétaire ne peut pas être modifié ou retiré.'; end if;
if auth.uid()<>owner_id and (actor_role is distinct from 'admin' or target_role='admin' or member_id=auth.uid() or new_role='admin') then raise exception 'Seul le propriétaire peut gérer les administrateurs.'; end if;
if new_role is null then
delete from public.taskboard_team_members where team_id=tid and user_id=member_id;
else
if new_role not in ('admin','member','viewer') then raise exception 'Rôle invalide.'; end if;
update public.taskboard_team_members set role=new_role where team_id=tid and user_id=member_id;
end if;
end; $$;
revoke all on function public.manage_taskboard_member(uuid,uuid,text) from public,anon;
grant execute on function public.manage_taskboard_member(uuid,uuid,text) to authenticated;
revoke update,delete on public.taskboard_team_members from authenticated;
drop policy if exists invitations_read_admin on public.taskboard_team_invitations;
create policy invitations_read_admin on public.taskboard_team_invitations for select to authenticated using(public.taskboard_manage_team(team_id));
drop policy if exists invitations_create_admin on public.taskboard_team_invitations;
create policy invitations_create_admin on public.taskboard_team_invitations for insert to authenticated with check(invited_by=auth.uid() and public.taskboard_manage_team(team_id) and (role<>'admin' or exists(select 1 from public.taskboard_teams t where t.id=team_id and t.owner_id=auth.uid())));
revoke update,delete on public.taskboard_team_invitations from authenticated;
create or replace function public.cancel_taskboard_invitation(invitation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
delete from public.taskboard_team_invitations i where i.id=invitation_id and i.accepted_at is null and public.taskboard_manage_team(i.team_id) and (i.role<>'admin' or exists(select 1 from public.taskboard_teams t where t.id=i.team_id and t.owner_id=auth.uid()));
if not found then raise exception 'Annulation impossible : invitation acceptée ou accès refusé.'; end if;
end; $$;
