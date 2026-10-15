import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {buildAdminLifecycleCandidate,withLocalPrincipalFixture,withLocalDeletionFixtures} from './admin-lifecycle-candidate.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
test('structure does not bootstrap the real principal or install a purge worker',()=>{
 const sql=buildAdminLifecycleCandidate(root);
 assert.equal((sql.match(/^begin;$/gm)??[]).length,1);
 assert.equal((sql.match(/^commit;$/gm)??[]).length,1);
 assert.doesNotMatch(sql,/quatrosus@gmail\.com|Confirmed initial principal missing|supabase\.co|net\.http_post|cron\.schedule|vault\./);
 assert.doesNotMatch(sql,/create (?:or replace )?function (?:public|maat_private)\.(?:claim_account_deletions|deletion_step|invoke_deletion_worker)/i);
 assert.match(sql,/execution_enabled boolean not null default false/);
 assert.match(sql,/revoke all on maat_private\.account_deletion_config from public,anon,authenticated,service_role/);
});
test('lifecycle guards replace the account helper and keep privileged admin API server-only',()=>{
 const sql=buildAdminLifecycleCandidate(root);
 assert.match(sql,/d\.status='processing'/);
 assert.match(sql,/auth\.sessions/);
 assert.match(sql,/Recent sign-in required/);
 assert.match(sql,/from public,anon,authenticated/);
 assert.match(sql,/create policy account_active_required on public\.taskboard_workspaces as restrictive/);
 assert.match(sql,/maat_private\.save_workspace\(uuid,bigint,jsonb\)/);
});
test('test principal and deletion fixtures stay inside rolled back transactions',()=>{
 const base='begin;\nselect 1;\nrollback;';
 const sql=withLocalPrincipalFixture(base);
 assert.match(sql,/^begin;\n-- Only synthetic local identity/);
 assert.match(sql,/principal-rehearsal@example.invalid/);
 assert.match(sql,/rollback;$/);
 assert.match(withLocalDeletionFixtures(base),/owner-rehearsal@example.invalid/);
 assert.throws(()=>withLocalPrincipalFixture('select 1;'),/marker/);
});
