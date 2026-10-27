-- Additive candidate. Apply only after the free-release baseline; no data deletion.
alter table public.taskboard_teams add column description text not null default '' check(char_length(description)<=2000);
alter table public.taskboard_teams add column archived_at timestamptz;
alter table public.taskboard_teams add column settings_version integer not null default 1;
alter table public.taskboard_shared_projects add column description text not null default '' check(char_length(description)<=2000);
alter table public.taskboard_shared_projects add column archived_at timestamptz;
alter table public.taskboard_shared_projects add column settings_version integer not null default 1;
alter table public.taskboard_shared_projects add column access_mode text not null default 'team' check(access_mode in ('team','restricted'));

create table public.taskboard_project_members(
 project_id uuid not null, team_id uuid not null, user_id uuid not null,
 role text not null check(role in ('member','viewer')),
 primary key(project_id,user_id),
 foreign key(project_id,team_id) references public.taskboard_shared_projects(id,team_id) on delete cascade,
 foreign key(team_id,user_id) references public.taskboard_team_members(team_id,user_id) on delete cascade
);
create index taskboard_project_members_user_idx on public.taskboard_project_members(user_id,project_id);
alter table public.taskboard_project_members enable row level security;
revoke all on public.taskboard_project_members from public,anon,authenticated;
grant select on public.taskboard_project_members to authenticated;

create function maat_private.project_access(pid uuid, account uuid, editing boolean)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.taskboard_shared_projects p
 join public.taskboard_team_members m on m.team_id=p.team_id and m.user_id=account
 join public.taskboard_teams t on t.id=p.team_id
 where p.id=pid and (not editing or (p.archived_at is null and t.archived_at is null))
 and (m.role in ('owner','admin') or
   ((not editing or m.role='member') and
    (p.access_mode='team' or exists(select 1 from public.taskboard_project_members pm
     where pm.project_id=p.id and pm.user_id=account and (not editing or pm.role='member'))))));
$$;
revoke all on function maat_private.project_access(uuid,uuid,boolean) from public,anon,authenticated;

create function maat_private.my_project_access(pid uuid, editing boolean)
returns boolean language sql stable security definer set search_path='' as $$
 select public.taskboard_account_active() and maat_private.project_access(pid,auth.uid(),editing);
$$;
revoke all on function maat_private.my_project_access(uuid,boolean) from public,anon;
grant execute on function maat_private.my_project_access(uuid,boolean) to authenticated;
create function public.taskboard_project_access(pid uuid, editing boolean default false)
returns boolean language sql stable security invoker set search_path='' as $$
 select maat_private.my_project_access(pid,editing);
$$;
revoke all on function public.taskboard_project_access(uuid,boolean) from public,anon;
grant execute on function public.taskboard_project_access(uuid,boolean) to authenticated;
create policy project_members_read on public.taskboard_project_members for select to authenticated
 using(public.taskboard_project_access(project_id,false));

-- Restrictive policies AND with every existing authorization policy.
create policy project_scope_read on public.taskboard_shared_projects as restrictive for select to authenticated
 using(public.taskboard_project_access(id,false));
create policy project_scope_update on public.taskboard_shared_projects as restrictive for update to authenticated
 using(public.taskboard_project_access(id,true)) with check(public.taskboard_project_access(id,true));
create policy project_scope_delete on public.taskboard_shared_projects as restrictive for delete to authenticated
 using(public.taskboard_project_access(id,true));
create policy task_scope_read on public.taskboard_shared_tasks as restrictive for select to authenticated
 using(public.taskboard_project_access(project_id,false));
create policy task_scope_insert on public.taskboard_shared_tasks as restrictive for insert to authenticated
 with check(public.taskboard_project_access(project_id,true));
create policy task_scope_update on public.taskboard_shared_tasks as restrictive for update to authenticated
 using(public.taskboard_project_access(project_id,true)) with check(public.taskboard_project_access(project_id,true));
create policy task_scope_delete on public.taskboard_shared_tasks as restrictive for delete to authenticated
 using(public.taskboard_project_access(project_id,true));
create policy subtask_scope_read on public.taskboard_shared_subtasks as restrictive for select to authenticated
 using(exists(select 1 from public.taskboard_shared_tasks t where t.id=task_id));
create policy subtask_scope_insert on public.taskboard_shared_subtasks as restrictive for insert to authenticated
 with check(exists(select 1 from public.taskboard_shared_tasks t where t.id=task_id and public.taskboard_project_access(t.project_id,true)));
create policy subtask_scope_update on public.taskboard_shared_subtasks as restrictive for update to authenticated
 using(exists(select 1 from public.taskboard_shared_tasks t where t.id=task_id and public.taskboard_project_access(t.project_id,true)))
 with check(exists(select 1 from public.taskboard_shared_tasks t where t.id=task_id and public.taskboard_project_access(t.project_id,true)));
create policy subtask_scope_delete on public.taskboard_shared_subtasks as restrictive for delete to authenticated
 using(exists(select 1 from public.taskboard_shared_tasks t where t.id=task_id and public.taskboard_project_access(t.project_id,true)));

-- Team writes only through the authenticated, version-checked settings RPC.
revoke update,delete on public.taskboard_teams from authenticated;

create function maat_private.team_settings(tid uuid, operation text, expected_version integer,
 new_name text default null, new_description text default null, successor uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare t public.taskboard_teams%rowtype; actor uuid:=auth.uid();
begin
 if not public.taskboard_account_active() then raise exception 'Connexion requise.' using errcode='42501';end if;
 select * into t from public.taskboard_teams where id=tid for update;
 if not found or not public.is_taskboard_team_member(tid) then raise exception 'Équipe inaccessible.' using errcode='42501';end if;
 if t.settings_version is distinct from expected_version then raise exception 'Les paramètres ont changé. Actualisez la page.' using errcode='PT409';end if;
 if operation='leave' then
  if t.owner_id=actor then raise exception 'Transférez la propriété avant de quitter l’équipe.' using errcode='42501';end if;
  delete from public.taskboard_team_invitations where team_id=tid and invited_by=actor and accepted_at is null;
  delete from public.taskboard_team_members where team_id=tid and user_id=actor;
  return;
 end if;
 if not public.taskboard_manage_team(tid) then raise exception 'Responsable requis.' using errcode='42501';end if;
 if operation='save' then
  if t.archived_at is not null then raise exception 'Rouvrez l’équipe pour la modifier.' using errcode='55000';end if;
  if new_name is null or char_length(btrim(new_name)) not between 2 and 100 or new_description is null or char_length(new_description)>2000 then raise exception 'Nom ou description invalide.' using errcode='22023';end if;
  update public.taskboard_teams set name=btrim(new_name),description=new_description,settings_version=settings_version+1 where id=tid;
 elsif operation in ('close','reopen','transfer') then
  if t.owner_id<>actor then raise exception 'Seul le propriétaire peut effectuer cette action.' using errcode='42501';end if;
  if operation='transfer' then
   if successor is null or successor=actor or not exists(select 1 from public.taskboard_team_members where team_id=tid and user_id=successor) then raise exception 'Choisissez un autre membre de l’équipe.' using errcode='22023';end if;
   perform 1 from auth.users u where u.id=successor and u.email_confirmed_at is not null for key share;
   if not found or exists(select 1 from public.taskboard_account_status where user_id=successor and suspended)
    or exists(select 1 from public.taskboard_account_deletions where user_id=successor and status in ('pending','processing')) then raise exception 'Ce compte ne peut pas devenir propriétaire.' using errcode='42501';end if;
   update public.taskboard_team_members set role='admin' where team_id=tid and user_id=actor;
   update public.taskboard_team_members set role='owner' where team_id=tid and user_id=successor;
   update public.taskboard_teams set owner_id=successor,settings_version=settings_version+1 where id=tid;
  else
   update public.taskboard_teams set archived_at=case when operation='close' then coalesce(archived_at,now()) else null end,settings_version=settings_version+1 where id=tid;
  end if;
 else raise exception 'Action invalide.' using errcode='22023';end if;
end $$;
revoke all on function maat_private.team_settings(uuid,text,integer,text,text,uuid) from public,anon;
grant execute on function maat_private.team_settings(uuid,text,integer,text,text,uuid) to authenticated;
create function public.taskboard_team_settings(tid uuid,operation text,expected_version integer,new_name text default null,new_description text default null,successor uuid default null)
returns void language sql security invoker set search_path='' as $$ select maat_private.team_settings(tid,operation,expected_version,new_name,new_description,successor); $$;
revoke all on function public.taskboard_team_settings(uuid,text,integer,text,text,uuid) from public,anon;
grant execute on function public.taskboard_team_settings(uuid,text,integer,text,text,uuid) to authenticated;

create function maat_private.project_settings(pid uuid,operation text,expected_version integer,
 new_title text default null,new_description text default null,new_access_mode text default null,
 target uuid default null,new_role text default null)
returns void language plpgsql security definer set search_path='' as $$
declare p public.taskboard_shared_projects%rowtype; tid uuid; closed timestamptz;
begin
 if not public.taskboard_account_active() then raise exception 'Connexion requise.' using errcode='42501';end if;
 select team_id into tid from public.taskboard_shared_projects where id=pid;
 select archived_at into closed from public.taskboard_teams where id=tid for update;
 if not found or not public.taskboard_manage_team(tid) then raise exception 'Responsable de l’équipe requis.' using errcode='42501';end if;
 select * into p from public.taskboard_shared_projects where id=pid for update;
 if not found or p.settings_version is distinct from expected_version then raise exception 'Le projet a changé. Actualisez la page.' using errcode='PT409';end if;
 if closed is not null then raise exception 'Rouvrez d’abord l’équipe.' using errcode='55000';end if;
 if operation='save' then
  if p.archived_at is not null then raise exception 'Rouvrez le projet pour le modifier.' using errcode='55000';end if;
  if new_title is null or char_length(btrim(new_title)) not between 1 and 100 or new_description is null or char_length(new_description)>2000 or new_access_mode is null or new_access_mode not in ('team','restricted') then raise exception 'Paramètres invalides.' using errcode='22023';end if;
  update public.taskboard_shared_projects set title=btrim(new_title),description=new_description,access_mode=new_access_mode,settings_version=settings_version+1 where id=pid;
 elsif operation in ('close','reopen') then
  update public.taskboard_shared_projects set archived_at=case when operation='close' then coalesce(archived_at,now()) else null end,settings_version=settings_version+1 where id=pid;
 elsif operation='member' then
  if p.archived_at is not null then raise exception 'Rouvrez le projet pour modifier les accès.' using errcode='55000';end if;
  if target is null or not exists(select 1 from public.taskboard_team_members where team_id=tid and user_id=target and role in ('member','viewer')) then raise exception 'Membre éligible requis.' using errcode='22023';end if;
  if new_role is null then delete from public.taskboard_project_members where project_id=pid and user_id=target;
  elsif new_role in ('member','viewer') then
   insert into public.taskboard_project_members(project_id,team_id,user_id,role) values(pid,tid,target,new_role)
   on conflict(project_id,user_id) do update set role=excluded.role;
  else raise exception 'Rôle invalide.' using errcode='22023';end if;
  update public.taskboard_shared_projects set settings_version=settings_version+1 where id=pid;
 else raise exception 'Action invalide.' using errcode='22023';end if;
end $$;
revoke all on function maat_private.project_settings(uuid,text,integer,text,text,text,uuid,text) from public,anon;
grant execute on function maat_private.project_settings(uuid,text,integer,text,text,text,uuid,text) to authenticated;
create function public.taskboard_project_settings(pid uuid,operation text,expected_version integer,new_title text default null,new_description text default null,new_access_mode text default null,target uuid default null,new_role text default null)
returns void language sql security invoker set search_path='' as $$ select maat_private.project_settings(pid,operation,expected_version,new_title,new_description,new_access_mode,target,new_role); $$;
revoke all on function public.taskboard_project_settings(uuid,text,integer,text,text,text,uuid,text) from public,anon;
grant execute on function public.taskboard_project_settings(uuid,text,integer,text,text,text,uuid,text) to authenticated;

-- Definer progress RPCs also fire these guards: UI/RLS bypass cannot edit closed work.
create function maat_private.guard_closed_work()
returns trigger language plpgsql security definer set search_path='' as $$
declare tid uuid; pid uuid; rowdata jsonb; closed boolean;
begin
 -- FK cleanup during a departure preserves work while removing its assignment.
 if tg_op='UPDATE' and pg_trigger_depth()>1 and new.assignee_id is null and old.assignee_id is not null
  and (to_jsonb(new)-'assignee_id')=(to_jsonb(old)-'assignee_id') then return new;end if;
 rowdata:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 tid:=(rowdata->>'team_id')::uuid;
 if tg_table_name='taskboard_shared_tasks' then pid:=(rowdata->>'project_id')::uuid;
 else select project_id into pid from public.taskboard_shared_tasks where id=(rowdata->>'task_id')::uuid;end if;
 if tg_op='UPDATE' and ((to_jsonb(old)->>'team_id') is distinct from (rowdata->>'team_id') or (to_jsonb(old)->>'project_id') is distinct from (rowdata->>'project_id') or (to_jsonb(old)->>'task_id') is distinct from (rowdata->>'task_id')) then raise exception 'Déplacement entre projets interdit.' using errcode='42501';end if;
 select archived_at is not null into closed from public.taskboard_teams where id=tid for share;
 if closed then raise exception 'Équipe close : lecture seule.' using errcode='55000';end if;
 select archived_at is not null into closed from public.taskboard_shared_projects where id=pid for share;
 if closed then raise exception 'Projet clos : lecture seule.' using errcode='55000';end if;
 if auth.uid() is not null and not maat_private.project_access(pid,auth.uid(),true) then raise exception 'Accès en modification au projet requis.' using errcode='42501';end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function maat_private.guard_closed_work() from public,anon,authenticated;
create trigger aa_guard_closed_work before insert or update or delete on public.taskboard_shared_tasks for each row execute function maat_private.guard_closed_work();
create trigger aa_guard_closed_work before insert or update or delete on public.taskboard_shared_subtasks for each row execute function maat_private.guard_closed_work();

create function maat_private.guard_closed_project_or_invitation()
returns trigger language plpgsql security definer set search_path='' as $$
declare closed timestamptz;
begin
 select archived_at into closed from public.taskboard_teams where id=new.team_id for share;
 if closed is not null then raise exception 'Équipe close : rouvrez-la avant cette action.' using errcode='55000';end if;
 if tg_op='UPDATE' and (new.team_id<>old.team_id or new.id<>old.id) then raise exception 'Identité immuable.' using errcode='42501';end if;
 return new;
end $$;
revoke all on function maat_private.guard_closed_project_or_invitation() from public,anon,authenticated;
create trigger aa_guard_closed_team before insert or update on public.taskboard_shared_projects for each row execute function maat_private.guard_closed_project_or_invitation();
create trigger aa_guard_closed_team before insert or update on public.taskboard_team_invitations for each row execute function maat_private.guard_closed_project_or_invitation();
