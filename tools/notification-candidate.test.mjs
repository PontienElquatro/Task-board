import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {buildNotificationCandidate,notificationSources,withLocalNotificationFixtures} from './notification-candidate.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
test('notifications use one transaction and preserve preference patches after navigation definitions',()=>{
 const candidate=buildNotificationCandidate(root);
 assert.equal(candidate.sources.length,9);
 assert.deepEqual(candidate.sources.map(x=>x.name),notificationSources);
 assert.equal((candidate.sql.match(/^begin;$/gm)??[]).length,1);
 assert.equal((candidate.sql.match(/^commit;$/gm)??[]).length,1);
 assert.ok(notificationSources.indexOf('notification-navigation.sql')<notificationSources.indexOf('notification-preferences.sql'));
 assert.doesNotMatch(candidate.sql,/supabase\.co|net\.http_post|cron\.schedule|RESEND_API_KEY/);
 assert.match(candidate.sql,/email_assignments boolean not null default false/);
});
test('notifications explicitly replace inherited broad grants and restrict privileged functions',()=>{
 const {sql}=buildNotificationCandidate(root);
 assert.match(sql,/revoke all on public\.taskboard_shared_subtasks,public\.taskboard_notifications from public,anon,authenticated/);
 assert.match(sql,/grant update\(read_at,dismissed_at\)/);
 assert.match(sql,/returns void language sql security invoker/);
 assert.match(sql,/create policy account_active_required on public\.taskboard_notifications as restrictive/);
});
test('fixtures stay inside the rollback transaction and missing markers fail closed',()=>{
 const sql=withLocalNotificationFixtures('begin;\nselect 1;\nrollback;');
 assert.match(sql,/^begin;\ninsert into auth\.users/);
 assert.match(sql,/rollback;$/);
 assert.throws(()=>withLocalNotificationFixtures('select 1;'),/marker missing/);
});
