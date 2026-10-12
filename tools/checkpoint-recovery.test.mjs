import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';

const source=await readFile(new URL('../src/app/core/storage/checkpoint-recovery.ts',import.meta.url),'utf8');
const code=stripTypeScriptTypes(source.replace(/^import .*$/gm,'').replace(/^export /gm,''));
const {validEnvelope,checkpointRecovery}=vm.runInNewContext(code+'\n({validEnvelope,checkpointRecovery});');
const copy=(writer,data,pending=true,account='a')=>({writer,account,updatedAt:'2026-10-12',envelope:{revision:1,data,pending,base:{}}});

assert.equal(validEnvelope(null),false);
assert.equal(validEnvelope({revision:-1,data:{},pending:true}),false);
assert.equal(validEnvelope({revision:Number.MAX_SAFE_INTEGER+1,data:{},pending:true}),false);
assert.equal(validEnvelope({revision:0,data:[],pending:false}),false);
assert.equal(validEnvelope({revision:1,data:{},pending:true,base:null}),false);
assert.equal(validEnvelope({revision:0,data:{},pending:false}),true);
assert.equal(checkpointRecovery([], 'a'),undefined);
assert.equal(checkpointRecovery([copy('private',{secret:true},true,'b')],'a'),undefined);
assert.equal(checkpointRecovery([null,copy('one',{items:['one']})],'a').ambiguous,false);
const recovered=checkpointRecovery([copy('clean',{},false),copy('one',{items:['one']}),copy('two',{items:['two']})],'a');
assert.equal(recovered.ambiguous,true);
assert.equal(JSON.stringify(recovered.envelope.data.items),'["one"]');
assert.equal(checkpointRecovery([copy('one',{a:1,b:2}),copy('two',{b:2,a:1})],'a').ambiguous,false);
const original=copy('one',{items:['original']});
checkpointRecovery([original],'a').envelope.data.items.push('edit');
assert.deepEqual(original.envelope.data.items,['original']);
assert.equal(checkpointRecovery([copy('bad',{},true,'b'),copy('clean',{items:['saved']},false)],'a').envelope.pending,false);
assert.equal(checkpointRecovery([{...copy('bad',{}),envelope:{revision:-1,data:{},pending:true}}],'a'),undefined);
console.log('15 checkpoint recovery assertions passed: validation, isolated accounts, ambiguous drafts, duplicate content and immutable copies.');
