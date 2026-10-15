import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildInvitationCandidate } from './invitation-candidate.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
test('invitation bundle keeps one top-level transaction and has no remote side effects',()=>{
 const sql=buildInvitationCandidate(root);
 assert.equal((sql.match(/^begin;$/gm)??[]).length,1);
 assert.equal((sql.match(/^commit;$/gm)??[]).length,1);
 assert.doesNotMatch(sql,/supabase\.co|net\.http_post|cron\.schedule|RESEND_API_KEY/);
 assert.match(sql,/email_confirmed_at is not null/);
 assert.match(sql,/invitation\.expires_at<=now\(\)/);
 assert.match(sql,/for update/);
 assert.match(sql,/grant select,insert on public\.taskboard_team_invitations to authenticated/);
});
test('private guards precede hardening and profiles stay scoped by membership',()=>{
 const sql=buildInvitationCandidate(root);
 assert.ok(sql.indexOf('create function public.taskboard_account_active()')<sql.indexOf('create or replace function public.accept_taskboard_team_invitation'));
 assert.match(sql,/create policy account_active_required/);
 assert.match(sql,/public\.is_taskboard_team_member\(m\.team_id\)/);
 assert.match(sql,/security invoker/);
 assert.match(sql,/private_name/);
});
