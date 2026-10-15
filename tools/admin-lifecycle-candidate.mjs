// Local-only administration + request/cancel foundation. No purge worker/scheduler.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
export function buildAdminLifecycleCandidate(root){
 const read=name=>readFileSync(join(root,'database',name),'utf8').replace(/\r\n/g,'\n');
 const deletion=read('account-deletion.sql');
 if((deletion.match(/^begin;$/gm)??[]).length!==1||(deletion.match(/^commit;$/gm)??[]).length!==1)throw new Error('Review deletion transaction');
 const access=read('admin-access.sql');
 const bootstrap=/do \$\$\s*declare principal uuid;[\s\S]*?\$\$;/g;
 if((access.match(bootstrap)??[]).length!==1)throw new Error('Review principal bootstrap boundary');
 const noBootstrap=access.replace(bootstrap,'-- Principal bootstrap deliberately omitted; separate authorized operation.');
 if(noBootstrap.includes('quatrosus@gmail.com'))throw new Error('Principal identity leaked into structural stage');
 return `begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
${deletion.replace(/^begin;$/m,'').replace(/^commit;$/m,'')}
alter table maat_private.account_deletion_config enable row level security;
alter table maat_private.account_deletion_config add column execution_enabled boolean not null default false;
revoke all on maat_private.account_deletion_config from public,anon,authenticated,service_role;
${read('account-deletion-security.sql')}
-- Audit additions without resetting existing history.
alter table public.taskboard_admin_audit add column target_id uuid,
 add column reason text,add column auth_sync text check(auth_sync in ('pending','success','failed'));
alter table public.taskboard_admin_audit drop constraint taskboard_admin_audit_action_check;
alter table public.taskboard_admin_audit add constraint taskboard_admin_audit_action_check
 check(action in ('dashboard_view','account_suspend','account_reactivate'));
grant update(auth_sync) on public.taskboard_admin_audit to service_role;
${noBootstrap}
${read('admin-moderation-permissions.sql')}
${read('admin-platform-settings.sql')}
${read('admin-team-directory.sql')}
${read('admin-metrics.sql')}
-- No implicit administrator exists after structural installation.
revoke all on maat_private.admin_members,maat_private.admin_control,maat_private.admin_access_events
 from public,anon,authenticated,service_role;
revoke all on function maat_private.admin_email_protection() from public,anon,authenticated,service_role;
create policy account_active_required on public.taskboard_workspaces as restrictive for all to authenticated
 using ((select public.taskboard_account_active())) with check ((select public.taskboard_account_active()));
-- These definer entrypoints must reject before touching any rows.
do $$declare f regprocedure;definition text;begin
 foreach f in array array['maat_private.save_workspace(uuid,bigint,jsonb)'::regprocedure,
 'maat_private.progress_taskboard_work(uuid,boolean,text)'::regprocedure] loop
  definition:=pg_get_functiondef(f);
  if strpos(definition,'if not public.taskboard_account_active()')>0 then raise exception 'Already guarded entrypoint';end if;
  definition:=regexp_replace(definition,'\\mbegin\\M',E'begin\\n if not public.taskboard_account_active() then raise exception ''Account unavailable'' using errcode=''42501''; end if;','i');
  execute definition;
 end loop;
end$$;
commit;
`;
}

export function withLocalPrincipalFixture(sql){
 const result=sql.replace(/^begin;\r?$/m,`begin;
-- Only synthetic local identity; no real principal or credentials copied.
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-000000000101','principal-rehearsal@example.invalid',now());
insert into maat_private.admin_members(user_id,permissions) values
 ('00000000-0000-4000-8000-000000000101',array['overview','users_read','users_manage','teams_read','audit_read','settings_read','settings_manage']);
insert into maat_private.admin_control(singleton,principal_id) values(true,'00000000-0000-4000-8000-000000000101');
insert into public.taskboard_admin_allowlist(email) values('principal-rehearsal@example.invalid');`);
 if(result===sql)throw new Error('Admin test transaction marker missing');
 return result;
}
export function withLocalDeletionFixtures(sql){
 const result=sql.replace(/^begin;\r?$/m,`begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-000000000111','deletion-rehearsal@example.invalid',now()),
 ('00000000-0000-4000-8000-000000000112','owner-rehearsal@example.invalid',now());
insert into public.taskboard_teams(owner_id,name) values('00000000-0000-4000-8000-000000000112','Local owner deletion protection');`);
 if(result===sql)throw new Error('Deletion test transaction marker missing');
 return result;
}
