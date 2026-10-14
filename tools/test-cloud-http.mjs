import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { Buffer } from 'node:buffer';
import { request as httpsRequest } from 'node:https';
const TEST_ORIGIN='https://fuvbwupoilkkawqhhdns.supabase.co';
const IDS=['00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000062'];
const EMAILS=['maat-fixture-a@example.invalid','maat-fixture-b@example.invalid'];
/** Real Auth + PostgREST integration. Refuses any project except Maat-test. */
export async function testCloudHttp({url=TEST_ORIGIN,key,password}) {
  assert.equal(new URL(url).origin,TEST_ORIGIN,'Production and other projects are forbidden');
  assert.ok(key?.startsWith('sb_publishable_'),'Use a public publishable key only');
  assert.ok(password,'Temporary fixture password required');
  const sessions=[];const results=[];let requests=0;let primaryError;
  async function request(path,{method='GET',token,body,headers={}}={}){
    const payload=body===undefined?undefined:JSON.stringify(body);
    const response=await new Promise((resolve,reject)=>{
      const outgoing=httpsRequest(new URL(path,TEST_ORIGIN),{method,agent:false,headers:{apikey:key,Connection:'close',...(token?{Authorization:'Bearer '+token}:{}),...(payload!==undefined?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}:{}),...headers}},incoming=>{
        if(path.startsWith('/rest/v1/rpc/'))console.log('RPC response: HTTP '+incoming.statusCode);
        const chunks=[];incoming.on('data',chunk=>chunks.push(chunk));incoming.on('error',reject);
        incoming.on('end',()=>resolve({status:incoming.statusCode,raw:Buffer.concat(chunks).toString()}));
      });
      outgoing.setTimeout(20000,()=>outgoing.destroy(new Error('HTTP timeout: '+method+' '+path)));
      outgoing.on('error',reject);outgoing.end(payload);
    });
    requests++;let data;try{data=response.raw?JSON.parse(response.raw):null;}catch{data=null;}
    return {status:response.status,data};
  }
  const ok=(condition,label)=>{assert.ok(condition,label);results.push(label);console.log('PASS: '+label);};
  const denied=(response,status,code,label)=>ok(response.status===status && (!code || (response.data?.error_code ?? response.data?.code)===code),label+' (HTTP '+response.status+')');
  const rpc=(token,id,revision,data)=>request('/rest/v1/rpc/save_taskboard_workspace_for_user',{method:'POST',token,body:{workspace_user:id,expected_revision:revision,workspace_data:data}});
  try {
    const wrong=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:EMAILS[0],password:'incorrect-test-only'}});
    denied(wrong,400,'invalid_credentials','Incorrect password rejected');
    for(let i=0;i<2;i++){
      const login=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:EMAILS[i],password}});
      ok(login.status===200 && login.data?.user?.id===IDS[i] && !!login.data?.access_token,'Real Auth login '+(i+1));
      sessions.push(login.data);
      const verified=await request('/auth/v1/user',{token:login.data.access_token});
      ok(verified.status===200 && verified.data?.id===IDS[i],'Server-verified user '+(i+1));
    }
    const a=sessions[0].access_token,b=sessions[1].access_token;
    denied(await request('/rest/v1/taskboard_workspaces?select=user_id,revision'),401,'42501','Anonymous table read rejected');
    denied(await rpc(undefined,IDS[0],0,{}),401,'42501','Anonymous RPC rejected');
    denied(await request('/rest/v1/taskboard_workspaces?select=user_id',{token:'invalid-test-token'}),401,undefined,'Invalid token rejected');
    const parts=a.split('.');const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString());claims.sub=IDS[1];parts[1]=Buffer.from(JSON.stringify(claims)).toString('base64url');
    denied(await request('/rest/v1/taskboard_workspaces?select=user_id',{token:parts.join('.')}),401,undefined,'Forged JWT rejected');
    denied(await rpc(a,IDS[0],1,[]),400,'22023','Array payload preflight rejected');
    for(let i=0;i<2;i++){
      const created=await rpc(sessions[i].access_token,IDS[i],0,{fixture:'http-'+i});
      ok(created.status===200 && created.data===1,'CAS create '+(i+1));
      const own=await request('/rest/v1/taskboard_workspaces?select=user_id,revision,data',{token:sessions[i].access_token});
      ok(own.status===200 && own.data.length===1 && own.data[0].user_id===IDS[i],'Only own workspace visible '+(i+1));
      const other=await request('/rest/v1/taskboard_workspaces?select=user_id&user_id=eq.'+IDS[1-i],{token:sessions[i].access_token});
      ok(other.status===200 && other.data.length===0,'Other workspace filtered '+(i+1));
      denied(await rpc(sessions[i].access_token,IDS[1-i],1,{}),403,'42501','Cross-account write rejected '+(i+1));
    }
    denied(await request('/rest/v1/taskboard_workspaces?user_id=eq.'+IDS[0],{method:'PATCH',token:a,body:{data:{fixture:'bypass'}}}),403,'42501','Direct UPDATE rejected');
    denied(await request('/rest/v1/taskboard_workspaces',{method:'POST',token:a,body:{user_id:IDS[0],data:{}}}),403,'42501','Direct INSERT rejected');
    denied(await request('/rest/v1/taskboard_workspaces?user_id=eq.'+IDS[0],{method:'DELETE',token:a}),403,'42501','Direct DELETE rejected');
    denied(await request('/rest/v1/taskboard_workspaces',{method:'POST',token:a,body:{user_id:IDS[0],data:{}},headers:{Prefer:'resolution=merge-duplicates'}}),403,'42501','Direct UPSERT rejected');
    for(const table of ['taskboard_admin_allowlist','taskboard_admin_audit'])denied(await request('/rest/v1/'+table+'?select=*',{token:a}),403,'42501','Private admin table '+table+' rejected');
    denied(await request('/rest/v1/rpc/save_taskboard_workspace',{method:'POST',token:a,body:{expected_revision:1,workspace_data:{}}}),403,'42501','Legacy endpoint rejected');
    denied(await rpc(a,IDS[0],0,{}),409,'PT409','Duplicate creation rejected');
    denied(await rpc(a,IDS[0],-1,{}),400,'22023','Negative revision rejected');
    denied(await rpc(a,IDS[0],null,{}),400,'22023','Null revision rejected');
    denied(await rpc(a,null,1,{}),403,'42501','Null account rejected');
    denied(await rpc(a,IDS[0],1,null),400,'22023','Null payload rejected');
    denied(await rpc(a,IDS[0],1,[]),400,'22023','Array payload rejected');
    const race=await Promise.all([rpc(a,IDS[0],1,{fixture:'http-race-one'}),rpc(a,IDS[0],1,{fixture:'http-race-two'})]);
    ok(race.filter(r=>r.status===200 && r.data===2).length===1 && race.filter(r=>r.status===409 && r.data?.code==='PT409').length===1,'Concurrent HTTP CAS: one success, one stale');
    const final=await request('/rest/v1/taskboard_workspaces?select=revision,data',{token:a});
    ok(final.status===200 && final.data[0].revision===2 && ['http-race-one','http-race-two'].includes(final.data[0].data.fixture),'Winning revision retained');
    denied(await rpc(a,IDS[0],1,{fixture:'late'}),409,'PT409','Late stale write rejected');
    const refresh=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:sessions[0].refresh_token}});
    ok(refresh.status===200 && refresh.data?.user?.id===IDS[0] && !!refresh.data?.access_token,'Real refresh token accepted');
    sessions[0]=refresh.data;
    const refreshed=await request('/auth/v1/user',{token:refresh.data.access_token});
    ok(refreshed.status===200 && refreshed.data?.id===IDS[0],'Refreshed session verified');
    return {checks:results.length,requests,results};
  }catch(error){primaryError=error;throw error;}finally{
    let cleanupFailed=false;
    for(const session of sessions){
      try{
        const logout=await request('/auth/v1/logout?scope=global',{method:'POST',token:session.access_token});
        if(logout.status!==204)cleanupFailed=true;
      }catch{cleanupFailed=true;}
    }
    if(cleanupFailed && !primaryError)throw new Error('Fixture logout incomplete; invalidate fixture sessions server-side');
  }
}
const runtimeProcess=globalThis.process;
if(runtimeProcess?.argv?.[1] && import.meta.url===pathToFileURL(runtimeProcess.argv[1]).href){
  try{const result=await testCloudHttp({key:process.env.MAAT_TEST_PUBLIC_KEY,password:process.env.MAAT_TEST_PASSWORD});console.log(JSON.stringify(result,null,2));}
  catch(error){console.error(error instanceof Error?error.message:'HTTP test failed');process.exitCode=1;}
}
