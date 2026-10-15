// Builds a LOCAL-ONLY intermediate candidate, not an approved production migration.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

export const collaborationCoreSources = [
  'teams.sql', 'team-management.sql', 'team-roles.sql', 'shared-projects.sql',
];
export function buildCollaborationCore(root) {
  const sources = collaborationCoreSources.map(name => ({ name,
    sql: readFileSync(join(root, 'database', name), 'utf8') }));
  return {
    sources: sources.map(({ name, sql }) => ({ name,
      sha256: createHash('sha256').update(sql).digest('hex') })),
    sql: `
-- LOCAL INTERMEDIATE CANDIDATE. Invitations/notifications/account lifecycle not ready.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$begin
 if to_regnamespace('maat_private') is null
   or to_regclass('public.taskboard_teams') is not null then
   raise exception 'Expected workspace-only rehearsal baseline';
 end if;
end$$;
${sources.map(({ name, sql }) => '-- Reviewed source: ' + name + '\n' + sql).join('\n')}

-- Do not expose intermediate invitation implementations. Next stage will
-- install and test the hardened lifecycle before granting client access.
revoke all on public.taskboard_team_invitations from public,anon,authenticated;
revoke all on function public.accept_taskboard_team_invitation(uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.cancel_taskboard_invitation(uuid) from public,anon,authenticated,service_role;

-- Atomic owner registration; clients cannot forge membership rows.
create function maat_private.register_team_owner()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.taskboard_team_members(team_id,user_id,role) values(new.id,new.owner_id,'owner');
 return new;
end$$;
revoke all on function maat_private.register_team_owner() from public,anon,authenticated,service_role;
create trigger taskboard_register_owner after insert on public.taskboard_teams
 for each row execute function maat_private.register_team_owner();
revoke insert,update,delete on public.taskboard_team_members from public,anon,authenticated;

-- Public functions are invokers; privileged implementations stay private.
do $$declare f record; definition text; args text;
begin
 for f in select p.*,p.oid as function_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in
 ('is_taskboard_team_member','taskboard_manage_team','taskboard_edit_team','manage_taskboard_member','taskboard_team_roster') loop
  definition:=replace(pg_get_functiondef(f.function_oid),format('FUNCTION public.%I(',f.proname),format('FUNCTION maat_private.%I(',f.proname));
  execute definition;
  execute format('alter function maat_private.%I(%s) set search_path to %L',f.proname,pg_get_function_identity_arguments(f.function_oid),'');
  select string_agg(format('$%s',i),', ' order by i) into args from generate_series(1,f.pronargs) i;
  execute format('create or replace function public.%I(%s) returns %s language sql %s security invoker set search_path='''' as %L',
    f.proname,pg_get_function_arguments(f.function_oid),pg_get_function_result(f.function_oid),
    case f.provolatile when 's' then 'stable' when 'i' then 'immutable' else 'volatile' end,
    format('select * from maat_private.%I(%s);',f.proname,coalesce(args,'')));
  execute format('revoke all on function maat_private.%I(%s) from public,anon,authenticated,service_role',f.proname,pg_get_function_identity_arguments(f.function_oid));
  execute format('grant execute on function maat_private.%I(%s) to authenticated,service_role',f.proname,pg_get_function_identity_arguments(f.function_oid));
  execute format('revoke all on function public.%I(%s) from public,anon,authenticated,service_role',f.proname,pg_get_function_identity_arguments(f.function_oid));
  execute format('grant execute on function public.%I(%s) to authenticated,service_role',f.proname,pg_get_function_identity_arguments(f.function_oid));
 end loop;
end$$;
grant usage on schema maat_private to service_role;
-- Default privileges restored from Supabase must not accidentally expose tables.
revoke all on public.taskboard_teams,public.taskboard_team_members,
 public.taskboard_shared_projects,public.taskboard_shared_tasks from public,anon,authenticated;
grant select,insert,update,delete on public.taskboard_teams,
 public.taskboard_shared_projects,public.taskboard_shared_tasks to authenticated;
grant select on public.taskboard_team_members to authenticated;
commit;
`,
  };
}
