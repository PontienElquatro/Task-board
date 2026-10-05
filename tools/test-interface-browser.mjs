// Disposable local preview; every remote request is intercepted. No real accounts.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { selectBackend } from './backend-config.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.MAAT_PLAYWRIGHT_PATH || 'playwright');
const origin=new URL(process.env.MAAT_TEST_URL || 'http://127.0.0.1:4215');
assert.ok(['localhost','127.0.0.1'].includes(origin.hostname));
const backend=selectBackend({}).url;
const user={id:'00000000-0000-4000-8000-000000000051',email:'designer@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{full_name:'Camille Martin'}};
const team={id:'team-fixture',owner_id:user.id,name:'Studio Ma’at',created_at:'2026-10-01T00:00:00Z'};
const project={id:'project-fixture',team_id:team.id,title:'Lancement du produit'};
const initialTasks=[{id:'task-fixture',project_id:project.id,team_id:team.id,title:'Préparer le lancement',description:'Une tâche claire avec un responsable.',status:'todo',assignee_id:user.id}];
await mkdir('outputs/ux',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN || undefined,args:['--disable-gpu','--disable-gpu-sandbox','--in-process-gpu']});
try {
 for(const width of [1440,390]) for(const theme of ['light','dark']) {
  let tasks=structuredClone(initialTasks);
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme});
  const expiry=Math.floor(Date.now()/1000)+3600;
  const jwt=[{alg:'HS256',typ:'JWT'},{sub:user.id,exp:expiry,aud:'authenticated'},'fixture'].map((v,i)=>i===2?v:Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
  await context.addInitScript(({user,jwt,expiry,key,theme})=>{sessionStorage.setItem(key,JSON.stringify({user,access_token:jwt,refresh_token:'fixture',expires_at:expiry,expires_in:3600,token_type:'bearer'}));localStorage.setItem('mytaskboard_theme',theme);},{user,jwt,expiry,key:'maat-auth-'+new URL(backend).hostname,theme});
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin===origin.origin)return route.continue();
   if(url.origin!==backend)return route.abort();
   const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(url.pathname==='/auth/v1/user')return json(user);
   if(url.pathname==='/functions/v1/taskboard-admin')return json({error:'Forbidden'},403);
   if(url.pathname.endsWith('/taskboard_workspaces'))return json({revision:1,data:{mytaskboard_tasks:[]}});
   if(url.pathname.endsWith('/taskboard_teams'))return json([team]);
   if(url.pathname.endsWith('/taskboard_team_roster'))return json([{team_id:team.id,user_id:user.id,role:'owner',display_name:'Camille Martin'}]);
   if(url.pathname.endsWith('/taskboard_team_invitations')||url.pathname.endsWith('/taskboard_notifications'))return json([]);
   if(url.pathname.endsWith('/taskboard_shared_projects'))return json([project]);
   if(url.pathname.endsWith('/taskboard_shared_subtasks'))return json([{id:'sub-fixture',task_id:'task-fixture',team_id:team.id,title:'Valider la maquette',completed:false,assignee_id:user.id}]);
   if(url.pathname.endsWith('/taskboard_shared_tasks')) {
    if(route.request().method()==='PATCH'){const data=route.request().postDataJSON();tasks=tasks.map(t=>({...t,...data}));return json([{id:'task-fixture'}]);}
    return json(tasks);
   }
   if(url.pathname.endsWith('/progress_taskboard_work')){const body=route.request().postDataJSON();tasks[0].status=body.new_status;return json(null);}
   return route.abort();
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('/team-projects',origin).href);
  await page.getByRole('button',{name:/Lancement du produit/}).click();
  await page.getByRole('button',{name:'Préparer le lancement',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();
  await dialog.getByLabel('Titre',{exact:true}).first().fill('Un brouillon conservé');
  await dialog.getByRole('button',{name:'Fermer les détails'}).click();
  await dialog.getByRole('button',{name:'Continuer',exact:true}).click();
  assert.equal(await dialog.getByLabel('Titre',{exact:true}).first().inputValue(),'Un brouillon conservé');
  await dialog.getByRole('button',{name:'Enregistrer',exact:true}).click();
  await page.getByRole('button',{name:'Un brouillon conservé',exact:true}).waitFor();
  await dialog.getByRole('button',{name:'Fermer les détails'}).click();
  await page.getByRole('checkbox',{name:/Terminer ou rouvrir/}).check();
  await page.waitForFunction(()=>document.querySelector('app-task-card input[type=checkbox]')?.checked);
  assert.equal(tasks[0].status,'done');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Only the board may scroll horizontally');
  await page.screenshot({path:`outputs/ux/team-board-${width}-${theme}.png`,fullPage:true});
  await page.getByRole('button',{name:'Nouvelle tâche',exact:true}).click();await page.getByRole('dialog').waitFor();
  assert.equal(await page.getByRole('dialog').getByLabel('Titre',{exact:true}).count(),1);
  await page.getByRole('button',{name:'Fermer les détails'}).click();
  await page.goto(new URL('/dashboard',origin).href);await page.getByRole('heading',{name:'Vue d’ensemble',exact:true}).waitFor();
  assert.deepEqual(errors,[]);console.log(`PASS ${width}px ${theme}: gallery, drawer, draft guard, save, completion, creation, dashboard, no runtime errors`);
  await context.close();
 }
} finally {await browser.close();}
