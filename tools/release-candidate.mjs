// Assembly only. Not a versioned migration or deployment authorization.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {buildCollaborationCore} from './collaboration-core-candidate.mjs';
import {buildInvitationCandidate} from './invitation-candidate.mjs';
import {buildNotificationCandidate} from './notification-candidate.mjs';
import {buildAdminLifecycleCandidate} from './admin-lifecycle-candidate.mjs';

export function stripStageTransaction(sql){
 sql=sql.replace(/\r\n/g,'\n');
 // Only exact top-level markers emitted by the reviewed builders. PL/pgSQL
 // blocks use begin without semicolon and must remain untouched.
 if((sql.match(/^begin;$/gm)??[]).length!==1 ||
    (sql.match(/^commit;$/gm)??[]).length!==1 || /^rollback;$/m.test(sql))
  throw new Error('Review stage transaction boundaries');
 return sql.replace(/^begin;$/m,'').replace(/^commit;$/m,'');
}
export function buildReleaseCandidate(root){
 const read=name=>readFileSync(join(root,'database/candidates',name),'utf8');
 const stages=[
  ['workspace',read('workspace-foundation.sql')],
  ['collaboration',buildCollaborationCore(root).sql],
  ['invitations',buildInvitationCandidate(root)],
  ['notifications',buildNotificationCandidate(root).sql],
  ['admin-lifecycle',buildAdminLifecycleCandidate(root)],
  ['calendar-guards',read('calendar-processing-guards.sql')],
 ];
 const sql='-- LOCAL ATOMIC CANDIDATE ONLY. No remote execution or administrator bootstrap.\nbegin;\n'+
  stages.map(([name,body])=>'-- Stage: '+name+'\n'+stripStageTransaction(body)).join('\n')+'\ncommit;\n';
 return {sql,sha256:createHash('sha256').update(sql).digest('hex'),
  stages:stages.map(([name,body])=>({name,sha256:createHash('sha256').update(body).digest('hex')}))};
}
