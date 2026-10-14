// Verify on-demand recovery UI against a real build; no account or external API.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {basename,dirname,extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const browserRoot=resolve(root,process.argv[2]||'dist/my-task-board/browser');
assert.ok(browserRoot.startsWith(root+sep+'dist'+sep));
const require=createRequire(import.meta.url);
process.env.PLAYWRIGHT_BROWSERS_PATH ||=resolve(root,'tmp/playwright-browsers');
const{chromium}=require('playwright');
const stats=JSON.parse(await readFile(resolve(browserRoot,'../stats.json'),'utf8'));
const recoveryChunks=Object.entries(stats.outputs).filter(([name,item])=>name.endsWith('.js')&&Object.keys(item.inputs||{}).some(p=>p.endsWith('shared/device-restore/device-restore.component.ts'))).map(([name])=>basename(name));
assert.ok(recoveryChunks.length,'The build must include a recovery component chunk');
const conflictChunks=Object.entries(stats.outputs).filter(([name,item])=>name.endsWith('.js')&&Object.keys(item.inputs||{}).some(p=>p.endsWith('shared/sync-conflict/sync-conflict.component.ts'))).map(([name])=>basename(name));
assert.ok(conflictChunks.length,'The build must include a conflict component chunk');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');let file=resolve(browserRoot,'.'+decodeURIComponent(url.pathname));if(file!==browserRoot&&!file.startsWith(browserRoot+sep)){res.writeHead(403);res.end();return}if(!extname(url.pathname))file=resolve(browserRoot,'index.csr.html');const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);}catch{if(!res.headersSent)res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
 browser=await chromium.launch({headless:true});
 for(const[width,theme,fail]of [[1440,'light',false],[390,'dark',false],[1440,'light',true]]){
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme});
  await context.addInitScript(theme=>{localStorage.setItem('mytaskboard_theme',theme);localStorage.setItem('maat-guide-hidden:local','true');},theme);
  await context.routeWebSocket('**/*',ws=>ws.close());
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();if(fail&&recoveryChunks.includes(basename(url.pathname)))return route.abort();return route.continue();});
  const p=await context.newPage(),errors=[],requested=[];
  p.on('pageerror',error=>errors.push(error.message));p.on('request',request=>{const url=new URL(request.url());if(url.origin===origin)requested.push(basename(url.pathname));});
  await p.goto(origin+'/board');await p.getByRole('button',{name:'Créer ma première tâche',exact:true}).waitFor();
  assert.ok(recoveryChunks.every(chunk=>!requested.includes(chunk)),'Recovery code must not load at startup');
  assert.ok(conflictChunks.every(chunk=>!requested.includes(chunk)),'Conflict code must not load without a conflict');
  const before=await p.evaluate(()=>localStorage.getItem('mytaskboard_tasks'));
  await p.locator('app-account-bar details > summary').first().click();
  await p.getByText('Sauvegardes',{exact:true}).click();
  await p.getByRole('button',{name:'Récupérer une copie',exact:true}).click();
  if(fail){
   const alert=p.getByRole('alert').filter({hasText:'La fenêtre de récupération est indisponible'});await alert.waitFor();
   await alert.getByRole('button',{name:'Fermer',exact:true}).click();await alert.waitFor({state:'detached'});
  }else{
   await p.getByRole('heading',{name:'Récupérer des tâches depuis une copie',exact:true}).waitFor();
   assert.ok(recoveryChunks.some(chunk=>requested.includes(chunk)),'Recovery module must load when requested');
   assert.equal(await p.locator('app-device-restore input[type=file]').count(),1);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No mobile page overflow');
  }
  assert.equal(await p.evaluate(()=>localStorage.getItem('mytaskboard_tasks')),before,'Opening/failure must not edit tasks');
  assert.deepEqual(errors,[]);
  console.log(`PASS ${width}px ${theme}: startup excludes recovery, ${fail?'failed import closes safely':'requested import renders real recovery UI'}, tasks unchanged`);
  await context.close();
 }
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
