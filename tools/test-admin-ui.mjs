import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../src/app/admin/admin.component.ts',import.meta.url),'utf8');
const method=name=>source.slice(source.indexOf('  '+name+'('),source.indexOf('\n  }',source.indexOf('  '+name+'('))+4);
let exported;
let clicked=false;
let download;
const context={
  Blob,
  URL:{createObjectURL:blob=>{exported=blob;return 'blob:test';},revokeObjectURL:()=>{}},
  document:{createElement:()=>({set download(value){download=value;},click(){clicked=true;}})},
  setTimeout:fn=>fn()
};
const exporter=vm.runInNewContext('({'+method('exportAudit')+'})',context);
exporter.auditEvents=()=>[{created_at:'2026-10-07',action:'=SUM(1)',actor_id:'user'}];
exporter.actorLabel=()=>'+unsafe;"quoted"';
exporter.exportAudit();
assert.ok(clicked);
assert.equal(download,'maat-journal-admin.csv');
const csv=await exported.text();
assert.ok(csv.includes('"\'=SUM(1)"'));
assert.ok(csv.includes('"\'+unsafe;""quoted"""'));
assert.equal(exported.type,'text/csv;charset=utf-8');

const users=Array.from({length:125},(_,i)=>({id:String(i),email:'user'+i,createdAt:String(i).padStart(3,'0'),admin:false,confirmed:true,updatedAt:null}));
const directory=vm.runInNewContext('({'+method('matchingUsers')+', filteredUsers(){return this.matchingUsers().slice((this.userPage-1)*50,this.userPage*50);}, pageCount(){return Math.max(1,Math.ceil(this.matchingUsers().length/50));}})');
Object.assign(directory,{snapshot:()=>({users}),search:'',roleFilter:'',confirmationFilter:'',syncFilter:'',sort:'recent',userPage:1});
assert.equal(directory.filteredUsers().length,50);
assert.equal(directory.pageCount(),3);
directory.userPage=3;
assert.equal(directory.filteredUsers().length,25);
directory.userPage=1;directory.search='user124';
assert.equal(directory.filteredUsers()[0].id,'124');
assert.equal(directory.pageCount(),1);
directory.search='';users[124].suspended=true;
directory.statusFilter='suspended';
assert.equal(directory.matchingUsers().length,1);
assert.equal(directory.matchingUsers()[0].id,'124');
directory.statusFilter='active';assert.equal(directory.matchingUsers().length,124);
directory.search='user124';assert.equal(directory.matchingUsers().length,0);
const auditMethod=source.split('\n').find(line=>line.trimStart().startsWith('auditEvents(){'));
const audit=vm.runInNewContext('({'+auditMethod+'})');
Object.assign(audit,{auditSearch:'',auditAction:'account_suspend',auditTarget:'124',actorLabel:id=>id,snapshot:()=>({events:[{actor_id:'admin',action:'account_suspend',target_id:'124',reason:'test'},{actor_id:'admin',action:'account_reactivate',target_id:'124'},{actor_id:'admin',action:'account_suspend',target_id:'other'}]})});
assert.equal(audit.auditEvents().length,1);
audit.auditSearch='absent';assert.equal(audit.auditEvents().length,0);
console.log('Admin UI: pagination, global search, status filters, account audit filters and CSV escaping passed.');
