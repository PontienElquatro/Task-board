import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
let handler,enabled=false,failFirst=false,calls=[];
const ids=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'];
const backend={rpc:async(name,args)=>{
 calls.push(name);
 if(name==='taskboard_deletion_step')return {data:args.operation==='objects'?[]:{},error:null};
 return {data:ids.map(user_id=>({user_id,claim_token:user_id})),error:null};
},auth:{admin:{
 updateUserById:async id=>({error:failFirst&&id===ids[0]?new Error('offline'):null}),
 deleteUser:async id=>{calls.push(id);return {error:null};}
}},storage:{from:()=>({list:async()=>({data:[],error:null}),remove:async()=>({error:null})})}};
const source=await readFile(new URL('../supabase/functions/account-deletion-worker/index.ts',import.meta.url),'utf8');
vm.runInNewContext(stripTypeScriptTypes(source.replace(/^import .*;\s*/,'')),{createClient:()=>backend,Deno:{serve:fn=>handler=fn,env:{get:name=>({ACCOUNT_DELETION_WORKER_SECRET:'test-secret',SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-only',ACCOUNT_DELETION_EXECUTE:enabled?'true':'false'})[name]}},Request,Response,JSON,Number,Error});
const req=(body={},secret='test-secret')=>new Request('https://test.invalid',{method:'POST',headers:{'x-worker-secret':secret},body:JSON.stringify(body)});
assert.equal((await handler(req({},'wrong'))).status,401);
assert.equal((await handler(req())).status,200);assert.equal(calls.length,0);
enabled=true;
assert.equal((await handler(req({userId:ids[0]}))).status,400);
failFirst=true;
const response=await handler(req());assert.equal(response.status,503);
const result=await response.json();assert.deepEqual(result.failed,[ids[0]]);assert.deepEqual(result.completed,[ids[1]]);
assert.equal(calls.includes(ids[0]),false);assert.equal(calls.includes(ids[1]),true);
console.log('Worker: authentication, disabled mode, input validation and isolated failures passed.');
