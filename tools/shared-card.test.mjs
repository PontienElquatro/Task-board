import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/app/core/collaboration/shared-card.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {sharedCard,matchesSharedAssignee}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const task={id:'t1',title:'Maquette',description:'Détails',status:'in-progress',assignee_id:'owner'};
const subs=[{id:'s1',task_id:'t1',title:'Valider',completed:true,assignee_id:'reader'},{id:'s2',task_id:'other',title:'Privée',completed:false,assignee_id:'someone'}];
test('shared card preserves workflow and only maps its own subtasks',()=>{
 const snapshot=structuredClone({task,subs});const card=sharedCard(task,subs);
 assert.equal(card.status,'in-progress');assert.deepEqual(card.subTasks,[{id:'s1',title:'Valider',completed:true}]);
 card.subTasks[0].completed=false;assert.deepEqual({task,subs},snapshot);
});
test('responsible filter includes delegated subtasks without including another project task',()=>{
 assert.equal(matchesSharedAssignee(task,subs,'owner'),true);
 assert.equal(matchesSharedAssignee(task,subs,'reader'),true);
 assert.equal(matchesSharedAssignee(task,subs,'someone'),false);
 assert.equal(matchesSharedAssignee(task,subs,'none'),false);
 assert.equal(matchesSharedAssignee({...task,assignee_id:null},subs,'none'),true);
 assert.equal(matchesSharedAssignee(task,subs,''),true);
});

test('shared cards expose local planned dates without changing workflow',()=>{
 const card=sharedCard({...task,start_date:'2026-10-05',end_date:'2026-10-08'},subs);
 assert.equal(card.startDate.getDate(),5);
 assert.equal(card.dueDate.getDate(),8);
 assert.equal(card.startDate.getHours(),12);
 assert.equal(card.status,'in-progress');
 assert.equal(sharedCard(task,subs).dueDate,undefined);
});
