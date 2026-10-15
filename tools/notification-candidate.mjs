// Intermediate local rehearsal only. No worker, email, cron or external call.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
export const notificationSources=[
 'shared-subtasks-notifications.sql','shared-task-workflow.sql','checklist-workflow.sql',
 'work-completion-notifications.sql','notification-navigation.sql',
 'notification-preferences.sql','dismiss-notifications.sql',
 'enriched-realtime-notifications.sql','shared-realtime.sql',
];
export function buildNotificationCandidate(root){
 const sources=notificationSources.map(name=>({name,sql:readFileSync(join(root,'database',name),'utf8')}));
 const bodies=sources.map(({name,sql})=>{
  if(name==='notification-preferences.sql'){
   if((sql.match(/^begin;\r?$/gm)??[]).length!==1||(sql.match(/^commit;\r?$/gm)??[]).length!==1)throw new Error('Review changed preference transaction boundaries');
   sql=sql.replace(/^begin;\r?$/m,'').replace(/^commit;\r?$/m,'');
  }
  return '-- Reviewed source: '+name+'\n'+sql;
 });
 return {sources:sources.map(({name,sql})=>({name,sha256:createHash('sha256').update(sql).digest('hex')})),sql:`begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$begin
 if to_regclass('public.taskboard_account_status') is null or to_regclass('public.taskboard_notifications') is not null then
  raise exception 'Expected invitations-only rehearsal baseline';
 end if;
 -- A local filtered restore has no platform publication. Catalog only; not a
 -- running Supabase Realtime service and not a network-delivery assertion.
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then
  create publication supabase_realtime;
 end if;
end$$;
${bodies.join('\n')}
-- Keep the independent email preference off; no queue or sender in this stage.
alter table public.taskboard_notification_preferences add column email_assignments boolean not null default false;
-- Supabase default grants include broad table rights. Replace them explicitly.
revoke all on public.taskboard_shared_subtasks,public.taskboard_notifications from public,anon,authenticated;
grant select,insert,update,delete on public.taskboard_shared_subtasks to authenticated;
grant select on public.taskboard_notifications to authenticated;
grant update(read_at,dismissed_at) on public.taskboard_notifications to authenticated;
revoke all on function public.notify_taskboard_assignment(),public.start_taskboard_parent_task() from public,anon,authenticated,service_role;
revoke all on function maat_private.notify_work_completion(),maat_private.enrich_notification(),
 maat_private.track_work_assignment(),maat_private.lock_checklist_parent(),maat_private.sync_checklist_parent()
 from public,anon,authenticated,service_role;

do $$declare definition text;begin
 definition:=pg_get_functiondef('public.progress_taskboard_work(uuid,boolean,text)'::regprocedure);
 definition:=replace(definition,'FUNCTION public.progress_taskboard_work(','FUNCTION maat_private.progress_taskboard_work(');
 execute definition;
end$$;
create or replace function public.progress_taskboard_work(work_id uuid,is_subtask boolean,new_status text)
returns void language sql security invoker set search_path='' as $$
 select maat_private.progress_taskboard_work(work_id,is_subtask,new_status);
$$;
revoke all on function public.progress_taskboard_work(uuid,boolean,text),maat_private.progress_taskboard_work(uuid,boolean,text) from public,anon,authenticated,service_role;
grant execute on function public.progress_taskboard_work(uuid,boolean,text),maat_private.progress_taskboard_work(uuid,boolean,text) to authenticated,service_role;
create policy account_active_required on public.taskboard_shared_subtasks as restrictive for all to authenticated
 using ((select public.taskboard_account_active())) with check ((select public.taskboard_account_active()));
create policy account_active_required on public.taskboard_notifications as restrictive for all to authenticated
 using ((select public.taskboard_account_active())) with check ((select public.taskboard_account_active()));
commit;
`};
}

export function withLocalNotificationFixtures(sql){
 const result=sql.replace(/^begin;\r?$/m,`begin;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000091'),('00000000-0000-4000-8000-000000000092');
insert into public.taskboard_teams(id,owner_id,name) values('10000000-0000-4000-8000-000000000091','00000000-0000-4000-8000-000000000091','Local notification fixtures');
insert into public.taskboard_team_members(team_id,user_id,role) values('10000000-0000-4000-8000-000000000091','00000000-0000-4000-8000-000000000092','member');`);
 if(result===sql)throw new Error('Notification test transaction marker missing');
 return result;
}
