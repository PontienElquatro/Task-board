import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

let handler;
let currentUser={id:'admin-id',email:'admin@example.invalid',email_confirmed_at:'2026-01-01'};
let authError=null;
let allow=true;
let rate=0;
let permissionFailure=false;
let auditFailure=false;
let auditWrites=0;
let metricsFailure=false;
let directory=null;
let actorSuspended=false;
let banFailure=false;
let mutationFailure=false;
let mutationCalls=0;
let bannedTarget='';
const directoryPages=[];
const auditRanges=[];
const selections=[];
class Query {
  constructor(table){this.table=table;this.filters={};}
  select(fields){selections.push([this.table,fields]);return this;}
  eq(field,value){this.filters[field]=value;return this;}
  gte(){return this;}
  in(){return this;}
  order(){return this;}
  limit(){return this;}
  range(start,end){auditRanges.push([start,end]);return this;}
  insert(){if(this.table==='taskboard_admin_audit')auditWrites++;return this;}
  update(){return this;}
  result(){
    if(this.table==='taskboard_account_status')return {data:this.filters.user_id?{suspended:actorSuspended}:[],error:null};
    if(this.table==='taskboard_admin_allowlist')return {data:this.filters.email ? (allow && this.filters.email===currentUser.email ? {email:this.filters.email}:null) : [{email:'admin@example.invalid'}],error:permissionFailure ? {message:'lookup failed'}:null};
    if(this.table==='taskboard_admin_audit')return {data:[],count:rate,error:auditFailure ? {message:'audit failed'}:null};
    return {data:[{user_id:'admin-id',updated_at:'2026-01-02'}],count:1,error:null};
  }
  maybeSingle(){return Promise.resolve(this.result());}
  then(resolve,reject){return Promise.resolve(this.result()).then(resolve,reject);}
}
const client={auth:{getUser:async()=>({data:{user:currentUser},error:authError}),admin:{listUsers:async()=>({data:{users:[{...currentUser,created_at:'2026-01-01',user_metadata:{role:'admin'},identities:['PRIVATE'],password:'PRIVATE'}],total:1},error:null})}},from:table=>new Query(table)};
const source=await readFile(new URL('../supabase/functions/taskboard-admin/index.ts',import.meta.url),'utf8');
client.rpc=async()=>({data:{teams:1,sharedProjects:1,pendingInvitations:0,expiredInvitations:0,acceptedInvitations:1},error:metricsFailure?new Error('Unavailable'):null});
const metricsRpc=client.rpc;
client.rpc=async(name,args)=>{
 if(name!=='taskboard_set_account_status')return metricsRpc();
 mutationCalls++;
 return {data:42,error:mutationFailure?{code:'PT409'}:null};
};
client.auth.admin.getUserById=async id=>({data:{user:{id,email:id.endsWith('002')?currentUser.email:'user@example.invalid'}},error:null});
client.auth.admin.updateUserById=async(id,attributes)=>{bannedTarget=attributes.ban_duration;return {error:banFailure?new Error('Auth unavailable'):null};};
const originalList=client.auth.admin.listUsers;
client.auth.admin.listUsers=async({page,perPage})=>{
  directoryPages.push(page);
  return directory?{data:{users:directory.slice((page-1)*perPage,page*perPage),total:directory.length},error:null}:originalList();
};
vm.runInNewContext(stripTypeScriptTypes(source.replace(/^import .*;\s*/,'')),{createClient:()=>client,Deno:{env:{get:name=>name==='SUPABASE_SECRET_KEYS' ? '{"default":"test-only-key"}':'https://test.invalid'},serve:fn=>handler=fn},Response,Request,Date,Set,Map,JSON,Number,Error});
const request=(body={},token='valid')=>new Request('https://test.invalid',{method:'POST',headers:token ? {Authorization:'Bearer '+token}: {},body:JSON.stringify(body)});
assert.equal((await handler(request({},null))).status,401);
authError={message:'expired'};assert.equal((await handler(request())).status,401);authError=null;
currentUser.email_confirmed_at=null;assert.equal((await handler(request())).status,403);currentUser.email_confirmed_at='2026-01-01';
allow=false;assert.equal((await handler(request())).status,403);allow=true;
assert.equal((await handler(request({page:0}))).status,400);
for(const invalid of [null,[],true,'admin',{page:1,role:'admin'},{page:1.5},{page:10001}]) assert.equal((await handler(request(invalid))).status,400);
assert.equal((await handler(request({padding:'x'.repeat(1100)}))).status,413);
assert.equal((await handler(new Request('https://test.invalid',{method:'POST',headers:{Authorization:'Bearer valid'},body:'{broken'}))).status,400);
permissionFailure=true;assert.equal((await handler(request())).status,503);permissionFailure=false;
auditFailure=true;assert.equal((await handler(request())).status,503);auditFailure=false;
currentUser.user_metadata={role:'admin',email:'admin@example.invalid'};allow=false;
assert.equal((await handler(request({page:1}))).status,403);allow=true;
assert.equal((await handler(new Request('https://test.invalid',{method:'GET'}))).status,405);
assert.equal((await handler(new Request('https://test.invalid',{method:'OPTIONS'}))).status,200);
rate=30;assert.equal((await handler(request())).status,429);rate=0;
const result=await handler(request());assert.equal(result.status,200);
const beforeCheck=auditWrites;
const check=await handler(request({action:'check_access'}));assert.equal(check.status,200);assert.deepEqual(await check.json(),{isAdmin:true});
assert.equal(auditWrites,beforeCheck);
metricsFailure=true;assert.equal((await handler(request())).status,503);metricsFailure=false;
assert.equal((await handler(request({action:'suspend'}))).status,400);
const snapshot=await result.json();
assert.deepEqual(Object.keys(snapshot.users[0]).sort(),['admin','confirmed','createdAt','email','id','lastSignIn','updatedAt','suspended'].sort());
assert.equal(snapshot.users[0].admin,true);
assert.equal(snapshot.workspaces,1);
assert.equal(snapshot.metrics.teams,1);
assert.ok(snapshot.generatedAt);
directory=Array.from({length:1051},(_,i)=>({...currentUser,id:'account-'+i,email:'account'+i+'@example.invalid',created_at:'2026-01-01'}));
directoryPages.length=0;
const globalSnapshot=await (await handler(request({auditPage:2}))).json();
assert.equal(globalSnapshot.users.length,1051);
assert.equal(globalSnapshot.total,1051);
assert.deepEqual(directoryPages,[1,2]);
assert.deepEqual(auditRanges.at(-1),[30,59]);
assert.equal(globalSnapshot.auditPage,2);
assert.equal((await handler(request({auditPage:0}))).status,400);
directory=null;
actorSuspended=true;assert.equal((await handler(request())).status,403);actorSuspended=false;
const accountAction={action:'suspend',targetId:'00000000-0000-4000-8000-000000000001',reason:'Motif de test uniquement',expectedSuspended:false};
assert.equal((await handler(request({...accountAction,reason:'court'}))).status,400);
assert.equal((await handler(request({...accountAction,targetId:'00000000-0000-4000-8000-000000000002'}))).status,403);
const oldId=currentUser.id;currentUser.id=accountAction.targetId;
assert.equal((await handler(request(accountAction))).status,403);currentUser.id=oldId;
mutationFailure=true;assert.equal((await handler(request(accountAction))).status,409);mutationFailure=false;
assert.equal((await handler(request(accountAction))).status,200);assert.equal(bannedTarget,'876000h');
assert.equal((await handler(request({...accountAction,action:'reactivate',expectedSuspended:true}))).status,200);assert.equal(bannedTarget,'none');
banFailure=true;const partial=await (await handler(request(accountAction))).json();assert.ok(partial.warning);banFailure=false;
assert.ok(mutationCalls>=4);
assert.ok(!selections.some(([table,fields])=>table==='taskboard_workspaces' && /data|\*/.test(fields)));
console.log('Admin Edge: checks passed (authentication, permissions, role probe without audit, metrics failures, pagination, rate limit, private data).');
