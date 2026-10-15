import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildReleaseCandidate,stripStageTransaction} from './release-candidate.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
test('versioned release is unique and identical to the frozen SQL',()=>{
 const dir=new URL('../supabase/migrations/',import.meta.url);
 const names=readdirSync(dir).filter(name=>name.endsWith('_maat_free_release.sql'));
 assert.equal(names.length,1);
 assert.equal(readFileSync(new URL(names[0],dir),'utf8'),
  readFileSync(new URL('../database/candidates/release-frozen.sql',import.meta.url),'utf8'));
});
test('frozen release is the exact successfully rehearsed artifact',()=>{
 const frozen=readFileSync(new URL('../database/candidates/release-frozen.sql',import.meta.url));
 assert.equal(createHash('sha256').update(frozen).digest('hex'),
  'c221758f3f566d6fa9e0f863c65ad78aebaa4b11d4d9e5bc06f4a7a76ea46aa6');
 assert.equal(buildReleaseCandidate(root).sql,frozen.toString('utf8'));
});
test('atomic assembly has six ordered stages and one commit',()=>{
 const result=buildReleaseCandidate(root);
 assert.equal(result.stages.length,6);
 assert.equal((result.sql.match(/^begin;$/gm)??[]).length,1);
 assert.equal((result.sql.match(/^commit;$/gm)??[]).length,1);
 assert.equal(result.sha256,buildReleaseCandidate(root).sha256);
 assert.ok(!result.sql.includes('quatrosus@gmail.com'));
 assert.ok(!result.sql.includes('create or replace function public.taskboard_claim_account_deletions'));
});
test('changed transaction boundaries fail closed',()=>{
 for(const sql of ['select 1;','begin;\nbegin;\ncommit;','begin;\nrollback;\ncommit;'])
  assert.throws(()=>stripStageTransaction(sql));
 assert.ok(stripStageTransaction('begin;\ndo $$begin\nnull;end$$;\ncommit;').includes('do $$begin'));
});
