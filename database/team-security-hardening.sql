-- Apply to TEST first. Stable public API, private privileged implementations.
begin;
create schema if not exists maat_private;
grant usage on schema maat_private to authenticated,service_role;
create or replace function maat_private.register_team_owner()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.taskboard_team_members(team_id,user_id,role) values(new.id,new.owner_id,'owner');
 return new;
end $$;
revoke all on function maat_private.register_team_owner() from public,anon,authenticated;
drop trigger if exists taskboard_register_owner on public.taskboard_teams;
create trigger taskboard_register_owner after insert on public.taskboard_teams
for each row execute function maat_private.register_team_owner();
insert into public.taskboard_team_members(team_id,user_id,role)
select id,owner_id,'owner' from public.taskboard_teams
on conflict(team_id,user_id) do update set role='owner';
revoke insert on public.taskboard_team_members from authenticated;
drop policy if exists invitations_create_admin on public.taskboard_team_invitations;
create policy invitations_create_admin on public.taskboard_team_invitations
for insert to authenticated with check (
 invited_by=auth.uid() and public.taskboard_manage_team(team_id)
 and (role<>'admin' or exists(select 1 from public.taskboard_teams t where t.id=team_id and t.owner_id=auth.uid()))
 and accepted_at is null and expires_at>now() and expires_at<=now()+interval '7 days'
 and char_length(token_hash)>=64
);

create or replace function public.accept_taskboard_team_invitation(invitation_id uuid, invitation_token text)
returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.taskboard_team_invitations%rowtype; tid uuid; team_owner uuid; recipient text;
begin
 if not public.taskboard_account_active() then raise exception 'Connexion requise ou compte suspendu.' using errcode='42501'; end if;
 select u.email into recipient from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 if recipient is null then raise exception 'Confirmez votre adresse email.' using errcode='42501'; end if;
 if invitation_token is null or char_length(invitation_token)<64 then raise exception 'Invitation invalide.' using errcode='22023'; end if;
 select i.team_id into tid from public.taskboard_team_invitations i where i.id=invitation_id;
 -- Same lock order as membership changes: team, then invitation/member.
 select t.owner_id into team_owner from public.taskboard_teams t where t.id=tid for update;
 if not found then raise exception 'Invitation invalide.' using errcode='22023'; end if;
 select * into invitation from public.taskboard_team_invitations i
 where i.id=invitation_id and i.team_id=tid and i.token_hash=invitation_token for update;
 if not found or lower(invitation.email) is distinct from lower(recipient) then
  raise exception 'Invitation invalide pour ce compte.' using errcode='42501';
 end if;
 if invitation.accepted_at is not null then
  if exists(select 1 from public.taskboard_team_members m where m.team_id=tid and m.user_id=auth.uid()) then return tid; end if;
  raise exception 'Invitation déjà utilisée.' using errcode='22023';
 end if;
 if invitation.expires_at<=now() then raise exception 'Invitation expirée.' using errcode='22023'; end if;
 if exists(select 1 from public.taskboard_account_status s where s.user_id=invitation.invited_by and s.suspended)
 or (invitation.invited_by<>team_owner and (
   invitation.role='admin' or not exists(select 1 from public.taskboard_team_members m
    where m.team_id=tid and m.user_id=invitation.invited_by and m.role='admin')
 )) then raise exception 'Droits retirés : demandez une nouvelle invitation.' using errcode='42501'; end if;
 insert into public.taskboard_team_members(team_id,user_id,role)
 values(tid,auth.uid(),invitation.role) on conflict(team_id,user_id) do nothing;
 update public.taskboard_team_invitations set accepted_at=now() where id=invitation.id;
 return tid;
end $$;

create or replace function public.cancel_taskboard_invitation(invitation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare tid uuid;
begin
 if not public.taskboard_account_active() then raise exception 'Connexion requise ou compte suspendu.' using errcode='42501'; end if;
 select i.team_id into tid from public.taskboard_team_invitations i where i.id=invitation_id;
 perform 1 from public.taskboard_teams t where t.id=tid for update;
 delete from public.taskboard_team_invitations i where i.id=invitation_id
 and i.accepted_at is null and public.taskboard_manage_team(i.team_id)
 and (i.role<>'admin' or exists(select 1 from public.taskboard_teams t where t.id=i.team_id and t.owner_id=auth.uid()));
 if not found then raise exception 'Invitation acceptée, introuvable ou accès refusé.' using errcode='42501'; end if;
end $$;

-- Preserve return types, argument defaults and volatility; no caller-supplied actor.
do $$
declare f record; definition text; call_args text; private_name text;
begin
 for f in select p.*,p.oid as function_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in (
 'accept_taskboard_team_invitation','cancel_taskboard_invitation',
 'manage_taskboard_member','is_taskboard_team_member','taskboard_edit_team',
 'taskboard_manage_team','taskboard_team_roster','progress_taskboard_work') loop
  private_name:=format('maat_private.%I',f.proname);
  definition:=replace(pg_get_functiondef(f.function_oid),format('FUNCTION public.%I(',f.proname),'FUNCTION '||private_name||'(');
  if f.prosecdef then execute definition; end if;
  select string_agg(format('$%s',i),', ' order by i) into call_args from generate_series(1,f.pronargs) i;
  execute format('create or replace function public.%I(%s) returns %s language sql %s security invoker set search_path='''' as %L',
   f.proname,pg_get_function_arguments(f.function_oid),pg_get_function_result(f.function_oid),
   case f.provolatile when 's' then 'stable' when 'i' then 'immutable' else 'volatile' end,
   'select * from '||private_name||'('||coalesce(call_args,'')||');');
  execute format('revoke all on function %s(%s) from public,anon,authenticated,service_role',private_name,pg_get_function_identity_arguments(f.function_oid));
  execute format('grant execute on function %s(%s) to authenticated,service_role',private_name,pg_get_function_identity_arguments(f.function_oid));
  execute format('revoke all on function public.%I(%s) from public,anon',f.proname,pg_get_function_identity_arguments(f.function_oid));
  execute format('grant execute on function public.%I(%s) to authenticated,service_role',f.proname,pg_get_function_identity_arguments(f.function_oid));
 end loop;
end $$;
commit;
