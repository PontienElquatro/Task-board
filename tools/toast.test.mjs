import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import '@angular/compiler';
const source=readFileSync(new URL('../src/app/services/toast.service.ts',import.meta.url),'utf8').replace("'@angular/core'",JSON.stringify(import.meta.resolve('@angular/core')));
const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}});
const {ToastService}=await import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));
test('success popup disappears after exactly three seconds',context=>{
 context.mock.timers.enable({apis:['setTimeout']});
 const toast=new ToastService();
 toast.success('Tâche créée.');
 context.mock.timers.tick(2999);assert.equal(toast.message(),'Tâche créée.');
 context.mock.timers.tick(1);assert.equal(toast.message(),'');
});
test('a second success resets its lifetime and manual close cancels it',context=>{
 context.mock.timers.enable({apis:['setTimeout']});
 const toast=new ToastService();
 toast.success('Premier');context.mock.timers.tick(2000);
 toast.success('Deuxième');context.mock.timers.tick(1000);
 assert.equal(toast.message(),'Deuxième');
 context.mock.timers.tick(2000);assert.equal(toast.message(),'');
 toast.success('Troisième');toast.dismiss();
 assert.equal(toast.message(),'');context.mock.timers.tick(3000);
 assert.equal(toast.message(),'');
});
