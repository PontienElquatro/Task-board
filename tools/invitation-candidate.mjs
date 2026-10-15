// Local intermediate stage; no email/network or production execution.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
export function buildInvitationCandidate(root) {
  const hardening=readFileSync(join(root,'database/team-security-hardening.sql'),'utf8');
  const profiles=readFileSync(join(root,'database/team-profiles.sql'),'utf8');
  if ((hardening.match(/^begin;\r?$/gm)??[]).length!==1 ||
      (hardening.match(/^commit;\r?$/gm)??[]).length!==1) throw new Error('Review changed hardening transaction boundaries');
  return `begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create table public.taskboard_account_status (
 user_id uuid primary key references auth.users(id) on delete cascade,
 suspended boolean not null default false,changed_at timestamptz not null default now());
alter table public.taskboard_account_status enable row level security;
revoke all on public.taskboard_account_status from public,anon,authenticated;
grant select on public.taskboard_account_status to authenticated;
grant select,insert,update on public.taskboard_account_status to service_role;
create policy account_status_self on public.taskboard_account_status for select to authenticated using(user_id=(select auth.uid()));
-- Deletion-processing guards will be integrated in the later account lifecycle stage.
create function maat_private.account_can_operate() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.users where id=auth.uid())
 and not exists(select 1 from public.taskboard_account_status where user_id=auth.uid() and suspended);
$$;
revoke all on function maat_private.account_can_operate() from public,anon,authenticated,service_role;
grant execute on function maat_private.account_can_operate() to authenticated,service_role,maat_workspace_writer;
create function public.taskboard_account_active() returns boolean
language sql stable security invoker set search_path='' as $$select maat_private.account_can_operate();$$;
revoke all on function public.taskboard_account_active() from public,anon,authenticated,service_role;
grant execute on function public.taskboard_account_active() to authenticated,service_role;

create or replace function maat_private.is_taskboard_team_member(team_uuid uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.taskboard_account_active() and exists(select 1 from public.taskboard_team_members where team_id=team_uuid and user_id=auth.uid());
$$;
create or replace function maat_private.taskboard_manage_team(tid uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.taskboard_account_active() and exists(select 1 from public.taskboard_teams t where t.id=tid
 and (t.owner_id=auth.uid() or exists(select 1 from public.taskboard_team_members m where m.team_id=t.id and m.user_id=auth.uid() and m.role='admin')));
$$;
create or replace function maat_private.taskboard_edit_team(tid uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.taskboard_account_active() and exists(select 1 from public.taskboard_team_members where team_id=tid and user_id=auth.uid() and role in ('owner','admin','member'));
$$;
do $$declare definition text;begin
 definition:=pg_get_functiondef('maat_private.manage_taskboard_member(uuid,uuid,text)'::regprocedure);
 definition:=regexp_replace(definition,'\\mbegin\\M',
 E'begin\\n if not public.taskboard_account_active() then raise exception ''Account unavailable'' using errcode=''42501''; end if;','i');
 execute definition;
end$$;

${hardening.replace(/^begin;\r?$/m,'').replace(/^commit;\r?$/m,'')}
${profiles}
-- Client creation/reading only. Accept/cancel use private checked functions.
revoke all on public.taskboard_team_invitations from public,anon,authenticated;
grant select,insert on public.taskboard_team_invitations to authenticated;
do $$declare t text;begin
 foreach t in array array['taskboard_teams','taskboard_team_members','taskboard_team_invitations','taskboard_shared_projects','taskboard_shared_tasks'] loop
  execute format('create policy account_active_required on public.%I as restrictive for all to authenticated using ((select public.taskboard_account_active())) with check ((select public.taskboard_account_active()))',t);
 end loop;
end$$;
commit;
`;
}
