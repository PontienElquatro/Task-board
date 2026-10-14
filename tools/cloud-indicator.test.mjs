import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/app/core/cloud-indicator.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
const {cloudIndicator}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('only confirmed authenticated cloud synchronization is green',()=>{
 assert.equal(cloudIndicator('Synchronisé avec votre compte',false,true,false,''),'saved');
 assert.equal(cloudIndicator('Synchronisé avec votre compte',true,true,false,''),'pending');
 assert.equal(cloudIndicator('Mode local',false,false,false,''),'local');
 assert.equal(cloudIndicator('Enregistré sur cet appareil · synchronisation en attente',false,true,false,''),'pending');
});
test('failed, conflicted or invalid sessions display a red cloud cross',()=>{
 for(const status of ['Cloud indisponible · réessayer','Cache illisible','Récupération impossible'])assert.equal(cloudIndicator(status,false,true,false,''),'error');
 assert.equal(cloudIndicator('Synchronisé avec votre compte',false,true,true,''),'error');
 assert.equal(cloudIndicator('Synchronisé avec votre compte',false,true,false,'Session indisponible'),'error');
});
