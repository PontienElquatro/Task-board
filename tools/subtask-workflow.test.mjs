import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/app/core/subtask-workflow.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {statusAfterChecklist:status}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const steps=(...values)=>values.map((completed,i)=>({id:String(i),completed}));
test('first completed step starts a task',()=>assert.equal(status(steps(false,false),steps(true,false),'todo'),'in-progress'));
test('last completed step closes a task, including a single step',()=>{
 assert.equal(status(steps(true,false),steps(true,true),'in-progress'),'done');
 assert.equal(status(steps(false),steps(true),'todo'),'done');
});
test('reopening any step reopens its completed parent',()=>{
 assert.equal(status(steps(true,true),steps(true,false),'done'),'in-progress');
 assert.equal(status(steps(true),steps(false),'done'),'in-progress');
});
test('unchecking all steps does not erase work already started',()=>assert.equal(status(steps(true,false),steps(false,false),'in-progress'),'in-progress'));
test('no steps never implies completion',()=>assert.equal(status(steps(false),[],'todo'),'todo'));
test('metadata and ordering changes preserve manual status',()=>{
 assert.equal(status(steps(false),steps(false),'done'),'done');
 assert.equal(status(steps(true),steps(true),'todo'),'todo');
 assert.equal(status(steps(true,false),steps(true,false).reverse(),'todo'),'todo');
});
test('adding work reopens a completed task, removing last unfinished step closes it',()=>{
 assert.equal(status(steps(true),steps(true,false),'done'),'in-progress');
 assert.equal(status(steps(true,false),steps(true),'in-progress'),'done');
});
test('adding unfinished steps to a fresh task leaves it to do and does not mutate input',()=>{
 const previous=steps(false),next=steps(false,false),snapshot=structuredClone({previous,next});
 assert.equal(status(previous,next,'todo'),'todo');assert.deepEqual({previous,next},snapshot);
});
