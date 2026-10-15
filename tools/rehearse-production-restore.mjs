// Local-only restoration; optional workspace candidate. Never connects to Supabase.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildCollaborationCore } from './collaboration-core-candidate.mjs';
import { buildInvitationCandidate } from './invitation-candidate.mjs';
import { buildNotificationCandidate,withLocalNotificationFixtures } from './notification-candidate.mjs';
import { buildAdminLifecycleCandidate,withLocalPrincipalFixture,withLocalDeletionFixtures } from './admin-lifecycle-candidate.mjs';
import { compareMigrationCatalog } from './compare-migration-catalog.mjs';
import { buildReleaseCandidate } from './release-candidate.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const options = process.argv.slice(2);
if (options.some(option => !['--workspace-foundation','--collaboration-core','--invitations','--notifications','--admin-lifecycle','--parity-audit','--calendar-guards','--atomic-candidate'].includes(option))) throw new Error('Unknown option');
const atomicCandidate = options.includes('--atomic-candidate');
if(atomicCandidate && options.length!==1)throw new Error('Use atomic candidate alone');
const calendarGuards = options.includes('--calendar-guards');
const parityAudit = options.includes('--parity-audit') || calendarGuards;
const adminLifecycle = options.includes('--admin-lifecycle') || parityAudit;
const notifications = options.includes('--notifications') || adminLifecycle;
const invitations = options.includes('--invitations') || notifications;
const collaborationCore = options.includes('--collaboration-core') || invitations;
const workspaceFoundation = options.includes('--workspace-foundation') || collaborationCore;
const bin = 'C:/Users/DELL/Documents/pgsql/bin';
const archive = 'C:/Users/DELL/Documents/Ma-at-backups/20261015-123017/MyTaskBoard.dump';
const expectedHash = '37b494b27fcb3ede7f20a86064ce051e0889d080330a38339a1013020324fcbc';
if (createHash('sha256').update(readFileSync(archive)).digest('hex') !== expectedHash) {
  throw new Error('Unexpected backup fingerprint; stop and review the archive.');
}
mkdirSync(join(root, 'tmp'), { recursive: true });
const work = mkdtempSync(join(root, 'tmp', 'production-rehearsal-'));
const data = join(work, 'data');
const pwfile = join(work, 'bootstrap-password');
const password = randomBytes(32).toString('hex');
// The generated password is local-only, never a production credential.
writeFileSync(pwfile, password + '\n', { flag: 'wx', mode: 0o600 });
const port = 55439;
// Empty PGSERVICEFILE is still treated as a filename by libpq on Windows.
// Remove inherited PG settings instead of assigning empty strings; then set
// only the local connection parameters. Do not alter the user's environment.
const localEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !/^PG/i.test(key)),
);
const env = { ...localEnvironment, PGHOST: '127.0.0.1', PGPORT: String(port),
  PGUSER: 'postgres', PGDATABASE: 'postgres', PGPASSWORD: password,
  PGCONNECT_TIMEOUT: '10', PGSSLMODE: 'disable' };
function run(name, args, input) {
  console.log('Étape : ' + name + ' ' + (name === 'pg_ctl' ? args.at(-1) : 'en cours'));
  const result = spawnSync(join(bin, name + '.exe'), args, {
    env, input, encoding: 'utf8', windowsHide: true, timeout: 120000,
    maxBuffer: 16 * 1024 * 1024,
    // A background postgres process can retain pg_ctl's pipe handles on Windows.
    // Do not wait on inherited stdout/stderr pipes after pg_ctl has returned.
    ...(name === 'pg_ctl' ? { stdio: 'ignore' } : {}),
  });
  if (result.error || result.status !== 0) {
    // SQL errors can contain data; keep diagnostics local, not in stdout.
    writeFileSync(join(work, name + '-failure.log'),
      String(result.error ?? '') + '\n' + result.stderr + '\n' + result.stdout);
    throw new Error(`${name} failed (code ${result.status}); diagnostics: ${work}`);
  }
  console.log('Terminé : ' + name);
  return result.stdout;
}
let started = false;
try {
  run('initdb', ['-D', data, '-U', 'postgres', '--auth=scram-sha-256',
    '--pwfile=' + pwfile, '--encoding=UTF8', '--locale=C']);
  unlinkSync(pwfile);
  run('pg_ctl', ['-D', data, '-l', join(work, 'server.log'), '-w', '-t', '30',
    '-o', `-h 127.0.0.1 -p ${port} -c wal_level=logical`, 'start']);
  started = true;
  const sql = `
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create role authenticator nologin;
    create role supabase_admin nologin;
    create role supabase_auth_admin nologin;
    create role supabase_storage_admin nologin;
    create role dashboard_user nologin;
    -- A schema-filtered pg_restore does not include the SCHEMA TOC entry.
    -- public exists in a new cluster; Supabase's auth schema must be prepared.
    create schema auth authorization supabase_admin;
    create schema extensions;
    create extension pgcrypto with schema extensions;
    create extension "uuid-ossp" with schema extensions;
  `;
  run('psql', ['-X', '-v', 'ON_ERROR_STOP=1'], sql);
  // Stock PostgreSQL does not include all Supabase-managed extensions.
  // Restore the actual Auth + application baseline, preserving ACL/owners.
  // This deliberately does NOT claim a full Supabase platform restoration.
  run('pg_restore', ['--exit-on-error', '--single-transaction', '--dbname=postgres',
    '--schema=auth', '--schema=public', archive]);
  // Schema ACL entries are omitted by the filtered restoration. These USAGE
  // grants were checked on production; this grants no access to Auth tables.
  run('psql', ['-X', '-v', 'ON_ERROR_STOP=1'],
    `grant usage on schema auth,public to anon,authenticated,service_role;
     -- FK checks execute as auth.users owner; its schema ACL is omitted too.
     -- Verified on production: supabase_auth_admin has USAGE on auth.
     grant usage on schema auth to supabase_auth_admin;`);
  const counts = run('psql', ['-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c',
    `select json_build_object('users',(select count(*) from auth.users),
      'workspaces',(select count(*) from public.taskboard_workspaces),
      'tables',(select count(*) from pg_tables where schemaname='public'));`]);
  writeFileSync(join(work, 'baseline-result.json'), counts);
  console.log('PASS local Auth/public restoration with owners and ACLs: ' + counts.trim());
  console.log('Rehearsal directory: ' + work);
  if (workspaceFoundation) {
    console.log('Candidat local : workspace-foundation');
    run('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-f',
      join(root, 'database/candidates/workspace-foundation.sql')]);
    // Reuse the reviewed security assertions, but supply disposable local
    // fixtures inside the same rollback transaction. Never run this remotely.
    const tests = readFileSync(join(root, 'database/workspaces-security-test.sql'), 'utf8');
    const localTests = tests.replace(/^begin;\r?$/m, `begin;
insert into auth.users(id) values
 ('00000000-0000-4000-8000-000000000061'),
 ('00000000-0000-4000-8000-000000000062');`);
    if (localTests === tests) throw new Error('Security test transaction marker missing');
    const output = run('psql', ['-X', '-v', 'ON_ERROR_STOP=1'], localTests);
    writeFileSync(join(work, 'workspace-security-results.log'), output);
    const expectedErrors = (output.match(/PASS /g) ?? []).length;
    if (expectedErrors !== 19) throw new Error('Unexpected security assertion count: ' + expectedErrors);
    const clean = run('psql', ['-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c',
      `select (select count(*) from auth.users)=0 and
        (select count(*) from public.taskboard_workspaces)=0;`]).trim();
    if (clean !== 't') throw new Error('Disposable fixtures were not fully rolled back');
    console.log('PASS workspace candidate: 19 expected-error assertions, revision/isolation checks, fixtures rolled back');
  }
  if (collaborationCore) {
    console.log('Candidat local : collaboration-core (invitations désactivées)');
    const candidate = buildCollaborationCore(root);
    writeFileSync(join(work, 'collaboration-core-sources.json'), JSON.stringify(candidate.sources,null,2));
    writeFileSync(join(work, 'collaboration-core-candidate.sql'), candidate.sql);
    run('psql', ['-X', '-v', 'ON_ERROR_STOP=1'], candidate.sql);
    const output = run('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-f',
      join(root, 'database/candidates/test-collaboration-core.sql')]);
    writeFileSync(join(work, 'collaboration-core-results.log'), output);
    if (!output.includes('PASS collaboration core; fixtures rolled back')) throw new Error('Collaboration success marker missing');
    const clean = run('psql', ['-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c',
      `select (select count(*) from auth.users)=0 and
        (select count(*) from public.taskboard_teams)=0 and
        (select count(*) from public.taskboard_shared_tasks)=0;`]).trim();
    if (clean !== 't') throw new Error('Collaboration fixtures were not rolled back');
    console.log('PASS collaboration core: role/isolation/revocation checks; fixtures rolled back; invitations disabled');
  }
  if (invitations) {
    console.log('Candidat local : invitations sécurisées (aucun email)');
    const candidate = buildInvitationCandidate(root);
    writeFileSync(join(work,'invitation-candidate.sql'),candidate);
    run('psql',['-X','-v','ON_ERROR_STOP=1'],candidate);
    const output=run('psql',['-X','-v','ON_ERROR_STOP=1','-f',join(root,'database/test-team-security.sql')]);
    writeFileSync(join(work,'invitation-results.log'),output);
    if (!output.includes('Team role, invitation, revocation, isolation and privilege tests passed; fixtures rolled back')) throw new Error('Invitation success marker missing');
    run('psql',['-X','-v','ON_ERROR_STOP=1','-f',join(root,'database/candidates/test-invitation-edge-cases.sql')]);
    const clean=run('psql',['-X','-A','-t','-v','ON_ERROR_STOP=1','-c',
      `select (select count(*) from auth.users)=0 and (select count(*) from public.taskboard_teams)=0
       and (select count(*) from public.taskboard_team_invitations)=0 and (select count(*) from public.taskboard_account_status)=0;`]).trim();
    if(clean!=='t')throw new Error('Invitation fixtures remain');
    console.log('PASS invitations: recipient/confirmation/expiry/issuer/replay/isolation checks; fixtures rolled back; no email');
  }
  if (notifications) {
    console.log('Candidat local : notifications internes et préférences (aucun email)');
    const candidate=buildNotificationCandidate(root);
    writeFileSync(join(work,'notification-candidate.sql'),candidate.sql);
    writeFileSync(join(work,'notification-sources.json'),JSON.stringify(candidate.sources,null,2));
    run('psql',['-X','-v','ON_ERROR_STOP=1'],candidate.sql);
    for(const name of ['test-notification-preferences.sql','test-notification-navigation.sql','test-enriched-realtime-notifications.sql']){
      console.log('Test local : '+name);
      const original=readFileSync(join(root,'database',name),'utf8');
      const sql=name==='test-enriched-realtime-notifications.sql'?original:withLocalNotificationFixtures(original);
      const output=run('psql',['-X','-v','ON_ERROR_STOP=1'],sql);
      writeFileSync(join(work,name+'.log'),output);
    }
    run('psql',['-X','-v','ON_ERROR_STOP=1','-f',join(root,'database/candidates/test-notification-privileges.sql')]);
    const clean=run('psql',['-X','-A','-t','-v','ON_ERROR_STOP=1','-c',
      `select (select count(*) from auth.users)=0 and (select count(*) from public.taskboard_teams)=0
      and (select count(*) from public.taskboard_notifications)=0 and (select count(*) from public.taskboard_notification_preferences)=0;`]).trim();
    if(clean!=='t')throw new Error('Notification fixtures remain');
    console.log('PASS internal notifications: preferences/assignment/completion/navigation/privileges; fixtures rolled back; no email; Realtime catalog only');
  }
  if(adminLifecycle){
    console.log('Candidat local : administration et demande/annulation de suppression (purge désactivée)');
    const candidate=buildAdminLifecycleCandidate(root);
    writeFileSync(join(work,'admin-lifecycle-candidate.sql'),candidate);
    run('psql',['-X','-v','ON_ERROR_STOP=1'],candidate);
    for(const name of ['test-admin-access.sql','test-admin-platform-settings.sql','test-admin-team-directory.sql','test-account-deletion.sql','account-security-test.sql']){
      console.log('Test local : '+name);
      const original=readFileSync(join(root,'database',name),'utf8');
      let sql;
      if(name.startsWith('test-admin-'))sql=withLocalPrincipalFixture(original);
      else if(name==='test-account-deletion.sql')sql=withLocalDeletionFixtures(original);
      else sql=original.replace(/^begin;\r?$/m,`begin;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000061'),('00000000-0000-4000-8000-000000000062');`);
      const output=run('psql',['-X','-v','ON_ERROR_STOP=1'],sql);
      writeFileSync(join(work,name+'.log'),output);
    }
    run('psql',['-X','-v','ON_ERROR_STOP=1','-f',join(root,'database/candidates/test-lifecycle-gates.sql')]);
    const clean=run('psql',['-X','-A','-t','-v','ON_ERROR_STOP=1','-c',
      `select (select count(*) from auth.users)=0 and (select count(*) from maat_private.admin_members)=0
       and (select count(*) from maat_private.admin_control)=0 and (select count(*) from public.taskboard_account_deletions)=0
       and not exists(select 1 from maat_private.account_deletion_config where enabled or execution_enabled);`]).trim();
    if(clean!=='t')throw new Error('Lifecycle fixtures or enabled deletion configuration remain');
    console.log('PASS admin/lifecycle: principal/delegation/sessions/settings/moderation/deletion-request guards; fixtures rolled back; purge disabled');
  }
  if(calendarGuards){
    console.log('Candidat local : calendrier et protections des comptes en traitement');
    run('psql',['-X','-v','ON_ERROR_STOP=1','-f',join(root,'database/candidates/calendar-processing-guards.sql')]);
    const output=run('psql',['-X','-v','ON_ERROR_STOP=1','-f',join(root,'database/candidates/test-calendar-processing-guards.sql')]);
    writeFileSync(join(work,'calendar-guards-results.log'),output);
    if(!output.includes('PASS calendar and processing guards; fixtures rolled back')) throw new Error('Calendar success marker missing');
    console.log('PASS calendar and processing guards; fixtures rolled back; purge disabled');
  }
  if(atomicCandidate){
    const candidate=buildReleaseCandidate(root);
    writeFileSync(join(work,'release-candidate.sql'),candidate.sql);
    writeFileSync(join(work,'release-manifest.json'),JSON.stringify({sha256:candidate.sha256,stages:candidate.stages},null,2));
    console.log('Candidat atomique local : '+candidate.sha256);
    run('psql',['-X','-v','ON_ERROR_STOP=1'],candidate.sql);
    for(const name of ['test-admin-access.sql','test-admin-platform-settings.sql','test-admin-team-directory.sql','test-account-deletion.sql','test-notification-preferences.sql','test-notification-navigation.sql','test-enriched-realtime-notifications.sql']){
      const original=readFileSync(join(root,'database',name),'utf8');
      const sql=name.startsWith('test-admin-')?withLocalPrincipalFixture(original):
        name==='test-account-deletion.sql'?withLocalDeletionFixtures(original):
        name==='test-enriched-realtime-notifications.sql'?original:withLocalNotificationFixtures(original);
      console.log('Test du candidat atomique : '+name);
      writeFileSync(join(work,name+'.log'),run('psql',['-X','-v','ON_ERROR_STOP=1'],sql));
    }
    for(const name of ['test-lifecycle-gates.sql','test-calendar-processing-guards.sql'])
      run('psql',['-X','-v','ON_ERROR_STOP=1','-f',join(root,'database/candidates',name)]);
    const clean=run('psql',['-X','-A','-t','-v','ON_ERROR_STOP=1','-c',
      `select (select count(*) from auth.users)=0 and (select count(*) from maat_private.admin_members)=0
       and (select count(*) from public.taskboard_teams)=0 and (select count(*) from public.taskboard_notifications)=0
       and not exists(select 1 from maat_private.account_deletion_config where enabled or execution_enabled);`]).trim();
    if(clean!=='t')throw new Error('Atomic rehearsal left fixtures or enabled deletion');
    console.log('PASS atomic candidate: one transaction; final-state tests passed; fixtures rolled back; no deployment approval');
  }
  if(parityAudit || atomicCandidate){
    console.log('Audit local de parité : catalogues seulement, aucun service distant');
    const reference=JSON.parse(readFileSync(join(root,'database/candidates/maat-test-catalog-reference.json'),'utf8'));
    const sql=readFileSync(join(root,'database/candidates/parity-inventory.sql'),'utf8');
    const output=run('psql',['-X','-A','-t','-v','ON_ERROR_STOP=1'],sql);
    const inventory=JSON.parse(output.trim());
    writeFileSync(join(work,'local-catalog.json'),JSON.stringify(inventory,null,2));
    const report={referenceProject:reference.sourceProject,referenceDate:reference.capturedOn,
      ...compareMigrationCatalog(reference.inventory,inventory)};
    writeFileSync(join(work,'parity-report.json'),JSON.stringify(report,null,2));
    console.log('AUDIT completed (not deployment approval): '+JSON.stringify(report.totals));
    console.log('Missing tables: '+report.differences.tables.missing.join(', '));
    console.log('Missing columns: '+report.differences.columns.missing.join(', '));
    console.log('Report: '+join(work,'parity-report.json'));
  }
} finally {
  try { unlinkSync(pwfile); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (started) run('pg_ctl', ['-D', data, '-w', '-t', '30', '-m', 'fast', 'stop']);
}
