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
const selections=[];
class Query {
  constructor(table){this.table=table;this.filters={};}
  select(fields){selections.push([this.table,fields]);return this;}
  eq(field,value){this.filters[field]=value;return this;}
  gte(){return this;}
  in(){return this;}
  order(){return this;}
  limit(){return this;}
  insert(){if(this.table==='taskboard_admin_audit')auditWrites++;return this;}
  result(){
    if(this.table==='taskboard_admin_allowlist')return {data:this.filters.email ? (allow ? {email:this.filters.email}:null) : [{email:'admin@example.invalid'}],error:permissionFailure ? {message:'lookup failed'}:null};
    if(this.table==='taskboard_admin_audit')return {data:[],count:rate,error:auditFailure ? {message:'audit failed'}:null};
    return {data:[{user_id:'admin-id',updated_at:'2026-01-02'}],count:1,error:null};
  }
  maybeSingle(){return Promise.resolve(this.result());}
  then(resolve,reject){return Promise.resolve(this.result()).then(resolve,reject);}
}
const client={auth:{getUser:async()=>({data:{user:currentUser},error:authError}),admin:{listUsers:async()=>({data:{users:[{...currentUser,created_at:'2026-01-01',user_metadata:{role:'admin'},identities:['PRIVATE'],password:'PRIVATE'}],total:1},error:null})}},from:table=>new Query(table)};
const source=await readFile(new URL('../supabase/functions/taskboard-admin/index.ts',import.meta.url),'utf8');
client.rpc=async()=>({data:{teams:1,sharedProjects:1,pendingInvitations:0,expiredInvitations:0,acceptedInvitations:1},error:metricsFailure?new Error('Unavailable'):null});
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
assert.deepEqual(Object.keys(snapshot.users[0]).sort(),['admin','confirmed','createdAt','email','id','lastSignIn','updatedAt'].sort());
assert.equal(snapshot.users[0].admin,true);
assert.equal(snapshot.workspaces,1);
assert.equal(snapshot.metrics.teams,1);
assert.ok(snapshot.generatedAt);
assert.ok(!selections.some(([table,fields])=>table==='taskboard_workspaces' && /data|\*/.test(fields)));
console.log('Admin Edge: checks passed (authentication, permissions, role probe without audit, metrics failures, pagination, rate limit, private data).');
