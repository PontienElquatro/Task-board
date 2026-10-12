import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
let handler,sent=[],allowed=true,accepted=false,expired=false,confirmed=true,mailOk=true;
const id='00000000-0000-4000-8000-000000000001';
const token='x'.repeat(72);
const client={
 auth:{getUser:async()=>({data:{user:{id:'owner',email_confirmed_at:confirmed?'2026-01-01':null}},error:null})},
 rpc:async()=>({data:allowed,error:null}),
 from:table=>({select:()=>({eq(){return this;},single:async()=>({data:table==='taskboard_teams'?{name:'Real <team>',owner_id:'owner'}:{id,email:'recipient@example.invalid',role:'member',token_hash:token,team_id:'team',accepted_at:accepted?'2026-01-01':null,expires_at:expired?'2000-01-01':'2099-01-01'},error:null})})})
};
const source=await readFile(new URL('../supabase/functions/send-team-invitation/index.ts',import.meta.url),'utf8');
vm.runInNewContext(stripTypeScriptTypes(source.replace(/^import .*;\s*$/gm,'')),{
 createClient:()=>client,Deno:{serve:fn=>handler=fn,env:{get:name=>({SUPABASE_URL:'https://test.invalid',SUPABASE_ANON_KEY:'test-only',RESEND_API_KEY:'test-only'})[name]}},
 Request,Response,URL,TextEncoder,Date,JSON,console,
 fetch:async(url,options)=>{sent.push({url,options});return new Response('provider-private-details',{status:mailOk?200:500});}
});
const req=(appUrl='https://task-board-v1-test-pontien-misengas-projects.vercel.app',overrides={})=>new Request('https://test.invalid',{method:'POST',headers:{Authorization:'Bearer test-only'},body:JSON.stringify({invitationId:id,token,appUrl,teamName:'Spoofed name',...overrides})});
assert.equal((await handler(new Request('https://test.invalid',{method:'GET'}))).status,405);
for(const origin of ['https://evil.invalid','https://evil.vercel.app','http://task-board-gold-xi.vercel.app','https://task-board-gold-xi.vercel.app/path','https://task-board-gold-xi.vercel.app?redirect=evil']){
 assert.equal((await (await handler(req(origin))).json()).sent,false);
}
assert.equal(sent.length,0);
assert.equal((await (await handler(req())).json()).sent,true);
assert.equal(sent.length,1);
const email=JSON.parse(sent[0].options.body);
assert.equal(email.subject,'Invitation à rejoindre Real <team>');assert.match(email.html,/Real &lt;team&gt;/);
assert.equal(sent[0].options.headers['Idempotency-Key'],`team-invitation/${id}`);
allowed=false;assert.equal((await (await handler(req())).json()).sent,false);allowed=true;
accepted=true;assert.equal((await (await handler(req())).json()).sent,false);accepted=false;
expired=true;assert.equal((await (await handler(req())).json()).sent,false);expired=false;
confirmed=false;assert.equal((await (await handler(req())).json()).sent,false);confirmed=true;
assert.equal((await (await handler(req(undefined,{token:'weak'}))).json()).sent,false);
assert.equal(sent.length,1);
mailOk=false;const result=await (await handler(req())).json();assert.equal(result.sent,false);assert.doesNotMatch(result.error,/provider-private-details/);
console.log('Invitation email: trusted origins, live permissions, confirmed account, lifecycle, safe content, idempotency and isolated errors passed.');
