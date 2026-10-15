import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildCollaborationCore, collaborationCoreSources } from './collaboration-core-candidate.mjs';
const root = fileURLToPath(new URL('..',import.meta.url));
test('local candidate uses the four reviewed structural sources in dependency order',()=>{
 const candidate=buildCollaborationCore(root);
 assert.deepEqual(candidate.sources.map(x=>x.name),collaborationCoreSources);
 assert.equal(candidate.sources.length,4);
 for(const source of candidate.sources)assert.match(source.sha256,/^[a-f0-9]{64}$/);
 assert.match(candidate.sql,/begin;/);
 assert.match(candidate.sql,/commit;\s*$/);
 assert.doesNotMatch(candidate.sql,/supabase\.co|cron\.schedule|net\.http_post|auth\.admin/);
});
test('invitation endpoints stay disabled and default broad table privileges are replaced',()=>{
 const {sql}=buildCollaborationCore(root);
 assert.match(sql,/revoke all on public\.taskboard_team_invitations from public,anon,authenticated/);
 assert.match(sql,/revoke all on function public\.accept_taskboard_team_invitation\(uuid,text\) from public,anon,authenticated,service_role/);
 assert.match(sql,/public\.taskboard_shared_projects,public\.taskboard_shared_tasks from public,anon,authenticated/);
 assert.match(sql,/grant select on public\.taskboard_team_members to authenticated/);
});
