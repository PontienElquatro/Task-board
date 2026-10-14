create or replace function public.accept_taskboard_team_invitation(invitation_id uuid, invitation_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare invitation public.taskboard_team_invitations%rowtype;
begin
if auth.uid() is null then raise exception 'Connectez-vous avant de rejoindre cette équipe.'; end if;
select * into invitation from public.taskboard_team_invitations where id=invitation_id and token_hash=invitation_token for update;
if not found then raise exception 'Lien d’invitation introuvable.'; end if;
if lower(invitation.email) <> lower(coalesce(auth.email(),'')) then raise exception 'Cette invitation est destinée à une autre adresse email.'; end if;
if invitation.accepted_at is not null then
 if exists(select 1 from public.taskboard_team_members where team_id=invitation.team_id and user_id=auth.uid()) then return invitation.team_id; end if;
 raise exception 'Cette invitation a déjà été utilisée. Demandez une nouvelle invitation.';
end if;
if invitation.expires_at <= now() then raise exception 'Cette invitation a expiré.'; end if;
insert into public.taskboard_team_members(team_id,user_id,role) values(invitation.team_id,auth.uid(),invitation.role) on conflict(team_id,user_id) do nothing;
update public.taskboard_team_invitations set accepted_at=now() where id=invitation.id;
return invitation.team_id;
end; $$;
revoke all on function public.accept_taskboard_team_invitation(uuid,text) from public, anon;
grant execute on function public.accept_taskboard_team_invitation(uuid,text) to authenticated;
