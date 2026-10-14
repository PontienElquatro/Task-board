-- Apply to TEST first. Suspension does not delete accounts or their data.
begin;
create table if not exists public.taskboard_account_status (
 user_id uuid primary key references auth.users(id) on delete cascade,
 suspended boolean not null default false,
 changed_at timestamptz not null default now()
);
alter table public.taskboard_account_status enable row level security;
revoke all on public.taskboard_account_status from public,anon,authenticated;
grant select on public.taskboard_account_status to authenticated;
grant select,insert,update on public.taskboard_account_status to service_role;
create policy account_status_self on public.taskboard_account_status
 for select to authenticated using (user_id=(select auth.uid()));

create or replace function public.taskboard_account_active()
returns boolean language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and not exists(
 select 1 from public.taskboard_account_status where user_id=auth.uid() and suspended);
$$;
revoke all on function public.taskboard_account_active() from public,anon;
grant execute on function public.taskboard_account_active() to authenticated,service_role;

-- Restrictive: ANDed with existing ownership/membership policies.
do $$
declare t text;
begin
 foreach t in array array['taskboard_workspaces','taskboard_teams','taskboard_team_members',
 'taskboard_team_invitations','taskboard_shared_projects','taskboard_shared_tasks',
 'taskboard_shared_subtasks','taskboard_notifications'] loop
 execute format('create policy account_active_required on public.%I as restrictive for all to authenticated using ((select public.taskboard_account_active())) with check ((select public.taskboard_account_active()))',t);
 end loop;
end $$;
create policy maat_avatar_account_active on storage.objects as restrictive for all to authenticated
 using (bucket_id<>'avatars' or (select public.taskboard_account_active()))
 with check (bucket_id<>'avatars' or (select public.taskboard_account_active()));

-- Existing definer RPCs bypass RLS: guard their entrypoints too.
do $$
declare f record; definition text;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='public' and p.proname in ('accept_taskboard_team_invitation',
 'cancel_taskboard_invitation','manage_taskboard_member','progress_taskboard_work'))
 or (n.nspname='maat_private' and p.proname='save_workspace') loop
 definition:=pg_get_functiondef(f.oid);
 definition:=regexp_replace(definition,'\mbegin\M',
 E'begin\n if not public.taskboard_account_active() then raise exception ''Compte suspendu ou connexion requise.'' using errcode=''42501''; end if;', 'i');
 execute definition;
 end loop;
end $$;
create or replace function public.is_taskboard_team_member(team_uuid uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.taskboard_account_active() and exists(select 1 from public.taskboard_team_members where team_id=team_uuid and user_id=auth.uid());
$$;
create or replace function public.taskboard_edit_team(tid uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.taskboard_account_active() and exists(select 1 from public.taskboard_team_members where team_id=tid and user_id=auth.uid() and role in ('owner','admin','member'));
$$;
create or replace function public.taskboard_manage_team(tid uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.taskboard_account_active() and exists(select 1 from public.taskboard_teams t where t.id=tid and (t.owner_id=auth.uid() or exists(select 1 from public.taskboard_team_members m where m.team_id=t.id and m.user_id=auth.uid() and m.role='admin')));
$$;

alter table public.taskboard_admin_audit drop constraint taskboard_admin_audit_action_check;
alter table public.taskboard_admin_audit add constraint taskboard_admin_audit_action_check
 check(action in ('dashboard_view','account_suspend','account_reactivate'));
alter table public.taskboard_admin_audit add column target_id uuid,
 add column reason text, add column auth_sync text check(auth_sync in ('pending','success','failed'));
grant update(auth_sync) on public.taskboard_admin_audit to service_role;

create or replace function public.taskboard_set_account_status(
 actor uuid, actor_email text, target uuid, target_email text,
 new_suspended boolean, expected_suspended boolean, action_reason text)
returns bigint language plpgsql security invoker set search_path='' as $$
declare audit_id bigint; previous boolean;
begin
 if actor=target then raise exception 'Votre propre compte est protégé.' using errcode='42501'; end if;
 if not exists(select 1 from public.taskboard_admin_allowlist where email=lower(actor_email))
 or exists(select 1 from public.taskboard_account_status where user_id=actor and suspended)
 then raise exception 'Accès administrateur refusé.' using errcode='42501'; end if;
 -- All platform admins are protected: stronger than protecting only the last.
 if exists(select 1 from public.taskboard_admin_allowlist where email=lower(target_email))
 then raise exception 'Les comptes administrateurs sont protégés.' using errcode='42501'; end if;
 if new_suspended is null or expected_suspended is null or char_length(trim(coalesce(action_reason,''))) not between 10 and 500
 then raise exception 'Motif requis (10 à 500 caractères).' using errcode='22023'; end if;
 insert into public.taskboard_account_status(user_id) values(target) on conflict do nothing;
 select suspended into previous from public.taskboard_account_status where user_id=target for update;
 if previous<>expected_suspended or previous=new_suspended then raise exception 'État modifié. Actualisez la liste.' using errcode='PT409'; end if;
 update public.taskboard_account_status set suspended=new_suspended,changed_at=now() where user_id=target;
 insert into public.taskboard_admin_audit(actor_id,action,target_id,reason,auth_sync)
 values(actor,case when new_suspended then 'account_suspend' else 'account_reactivate' end,target,trim(action_reason),'pending')
 returning id into audit_id;
 return audit_id;
end $$;
revoke all on function public.taskboard_set_account_status(uuid,text,uuid,text,boolean,boolean,text) from public,anon,authenticated;
grant execute on function public.taskboard_set_account_status(uuid,text,uuid,text,boolean,boolean,text) to service_role;
commit;
