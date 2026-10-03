// Browser integration test with a simulated backend. Never calls the live Supabase project.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { selectBackend } from './backend-config.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.MAAT_PLAYWRIGHT_PATH || 'playwright');
const origin=new URL(process.env.MAAT_TEST_URL || 'http://127.0.0.1:4213');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(origin.hostname),'Only a local preview may be tested');
const backend=selectBackend({}).url;
const user={id:'00000000-0000-4000-8000-000000000051',email:'cloud-test@example.invalid',aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{}};
const task=(id,title)=>({id,title,description:'',status:'todo',priority:'medium',subTasks:[],createdAt:'2026-10-01T00:00:00.000Z',userId:'default',order:0,tags:[],archived:false});
const ledger={revision:1,data:{mytaskboard_tasks:[task('a','A'),task('b','B')]},writes:[],active:0,maxActive:0};
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN || undefined,args:process.env.CHROME_BIN ? ['--no-sandbox','--disable-gpu','--disable-gpu-sandbox','--in-process-gpu']:[]});
const errors=[];
try {
  const context=await browser.newContext();
  const expiry=Math.floor(Date.now()/1000)+3600;
  const jwt=[{alg:'HS256',typ:'JWT'},{sub:user.id,exp:expiry,aud:'authenticated',role:'authenticated'},'test-only-signature'].map((part,i)=>i===2 ? part:Buffer.from(JSON.stringify(part)).toString('base64url')).join('.');
  await context.addInitScript(({user,jwt,expiry,key})=>{
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({access_token:jwt,refresh_token:'test-only',expires_at:expiry,expires_in:3600,token_type:'bearer',user}));
  },{user,jwt,expiry,key:'sb-'+new URL(backend).hostname.split('.')[0]+'-auth-token'});
  // Block all non-local network traffic, including unexpected calls and redirects.
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin===origin.origin)return route.continue();
    if(url.origin!==backend)return route.abort();
    const json=(status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if(url.pathname==='/auth/v1/user')return json(200,user);
    if(url.pathname==='/functions/v1/taskboard-admin')return json(403,{error:'Administrator required'});
    if(url.pathname==='/rest/v1/taskboard_workspaces')return json(200,{revision:ledger.revision,data:structuredClone(ledger.data)});
    if(url.pathname==='/rest/v1/rpc/save_taskboard_workspace_for_user'){
      const body=route.request().postDataJSON();
      assert.equal(body.workspace_user,user.id);
      ledger.active++;ledger.maxActive=Math.max(ledger.maxActive,ledger.active);
      try{
        await new Promise(resolve=>setTimeout(resolve,150));
        if(body.expected_revision!==ledger.revision)return await json(409,{code:'PT409',message:'Revision changed'});
        ledger.data=body.workspace_data;ledger.revision++;ledger.writes.push(body);
        return await json(200,ledger.revision);
      }finally{ledger.active--;}
    }
    return route.abort();
  });
  const first=await context.newPage(),second=await context.newPage();
  for(const page of [first,second]){page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());}
  await Promise.all([first.goto(origin.href),second.goto(origin.href)]);
  for(const page of [first,second]){
    await page.getByLabel('Statut de A',{exact:true}).waitFor();
    await page.getByText('✓ Sauvegardé',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>!!navigator.locks),true);
  }
  await Promise.all([first.getByLabel('Statut de A',{exact:true}).selectOption('in-progress'),second.getByLabel('Statut de B',{exact:true}).selectOption('done')]);
  for(const page of [first,second])await page.waitForFunction(()=>document.querySelector('[aria-label="Statut de A"]')?.value==='in-progress' && document.querySelector('[aria-label="Statut de B"]')?.value==='done');
  assert.equal(ledger.data.mytaskboard_tasks.find(t=>t.id==='a').status,'in-progress');
  assert.equal(ledger.data.mytaskboard_tasks.find(t=>t.id==='b').status,'done');
  assert.equal(ledger.maxActive,1,'Real browser locks must serialize RPC writes');
  console.log('PASS: independent edits merged; both tabs refreshed; maximum concurrent RPCs = 1');
  await second.getByRole('button',{name:'Modifier A',exact:true}).click();
  await second.getByLabel('Titre',{exact:false}).fill('Draft preserved');
  await first.getByLabel('Statut de B',{exact:true}).selectOption('todo');
  await first.getByText('✓ Sauvegardé',{exact:true}).waitFor();
  assert.equal(await second.getByLabel('Titre',{exact:false}).inputValue(),'Draft preserved');
  await second.getByRole('button',{name:'Fermer',exact:true}).click();
  await second.getByRole('button',{name:'Abandonner les modifications',exact:true}).click();
  await second.waitForFunction(()=>!document.querySelector('[role=dialog]') && document.querySelector('[aria-label="Statut de B"]')?.value==='todo');
  console.log('PASS: open form preserved and peer refresh applied after closing');
  ledger.data=structuredClone(ledger.data);ledger.data.mytaskboard_tasks.find(t=>t.id==='a').title='Remote A';ledger.revision++;
  const writesBeforeConflict=ledger.writes.length;
  await first.getByLabel('Statut de A',{exact:true}).selectOption('todo');
  await first.getByRole('heading',{name:'Comparer les versions'}).waitFor();
  assert.equal(ledger.writes.length,writesBeforeConflict);
  assert.equal(await first.getByRole('button',{name:'Appliquer mes choix'}).isDisabled(),true);
  await first.getByRole('button',{name:'Choisir cette version cloud'}).click();
  await first.getByRole('button',{name:'Appliquer mes choix'}).click();
  await first.getByLabel('Statut de Remote A',{exact:true}).waitFor();
  await first.getByText('✓ Sauvegardé',{exact:true}).waitFor();
  assert.ok(await first.evaluate(id=>!!localStorage.getItem('maat_recovery_'+id),user.id));
  console.log('PASS: same-task conflict blocks writes until explicit choice; recovery backup retained');
  await first.goto(new URL('/admin',origin).href);
  await first.getByText('Accès réservé aux administrateurs confirmés.',{exact:false}).waitFor();
  assert.equal(await first.locator('tbody tr').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: ordinary account denied admin UI; no runtime errors');
  console.log('Simulated backend only: these checks do not validate production RLS.');
}finally{await browser.close();}
