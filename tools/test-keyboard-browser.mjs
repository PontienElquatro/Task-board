// Real production build, disposable local contexts. All external requests are blocked.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const build=resolve(root,process.argv[2]||'dist/my-task-board/browser');
assert.ok(build.startsWith(root+sep+'dist'+sep),'Only an owned local build is allowed');
process.env.PLAYWRIGHT_BROWSERS_PATH ||=resolve(root,'tmp/playwright-browsers');
const {chromium}=createRequire(import.meta.url)('playwright');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  try {
    const path=new URL(req.url,'http://localhost').pathname;
    let file=resolve(build,'.'+decodeURIComponent(path));
    if(file!==build&&!file.startsWith(build+sep)){res.writeHead(403);res.end();return;}
    if(!extname(path))file=resolve(build,'index.csr.html');
    const bytes=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
  } catch {res.writeHead(404);res.end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin=`http://127.0.0.1:${server.address().port}`;
const output=resolve(root,'tmp/keyboard-visual');await mkdir(output,{recursive:true});
let browser;
try {
  browser=await chromium.launch({headless:true,timeout:60000});
  for(const [width,theme] of [[1440,'light'],[390,'light'],[390,'dark']]){
    const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce'});
    await context.addInitScript(theme=>{localStorage.setItem('mytaskboard_theme',theme);localStorage.setItem('maat-guide-hidden:local','true');},theme);
    await context.routeWebSocket('**/*',ws=>ws.close());
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/home');await page.locator('main h1').waitFor();
    const skip=page.getByRole('link',{name:'Aller au contenu',exact:true});
    await skip.focus();await page.keyboard.press('Enter');
    assert.ok(await page.locator('#main-content').evaluate(el=>document.activeElement===el),'Skip link moves focus');
    if(width<1000){
      const toggle=page.getByRole('button',{name:'Ouvrir le menu',exact:true});
      await toggle.focus();await page.keyboard.press('Enter');
      await page.waitForFunction(()=>document.activeElement===document.querySelector('#visitor-navigation a'));
      await page.keyboard.press('Tab');
      assert.ok(await page.locator('#visitor-navigation a').nth(1).evaluate(el=>document.activeElement===el),'Tab reaches the next visitor destination');
      await page.keyboard.press('Escape');assert.ok(await toggle.evaluate(el=>document.activeElement===el));
    }
    await page.goto(origin+'/board');
    const trigger=page.getByRole('button',{name:/^Nouvelle tâche(?:\s+N)?$/});await trigger.waitFor();
    if(width<640){
      const hamburger=page.getByRole('button',{name:'Ouvrir ou fermer les actions du compte',exact:true});
      assert.ok(await hamburger.evaluate(el=>{
        const account=el.previousElementSibling;
        return el.parentElement.lastElementChild===el && account?.tagName==='DETAILS' && el.getBoundingClientRect().left>=account.getBoundingClientRect().right-1;
      }),'Account hamburger is rightmost after identity, in DOM and on screen');
      await hamburger.press('Enter');
      await page.waitForFunction(()=>!!document.activeElement?.closest('#header-mobile-actions'));
      await page.keyboard.press('Escape');
      assert.equal(await hamburger.getAttribute('aria-expanded'),'false');
      assert.ok(await hamburger.evaluate(el=>document.activeElement===el),'Actions restore hamburger focus');
    }
    await trigger.focus();await page.keyboard.press('Enter');
    const dialog=page.getByRole('dialog',{name:'Nouvelle tâche',exact:true});await dialog.waitFor();
    const title=page.getByLabel('Titre (obligatoire)',{exact:true});
    await page.waitForFunction(()=>document.activeElement?.id==='task-title');
    await page.keyboard.insertText('Essai clavier local');
    await page.keyboard.press('Escape');
    const keep=page.getByRole('button',{name:'Continuer l’édition',exact:true});await keep.waitFor();
    await page.waitForFunction(()=>document.activeElement?.hasAttribute('data-continue-editing'));
    assert.equal(await title.inputValue(),'Essai clavier local','Escape never abandons edits');
    await page.screenshot({path:resolve(output,`discard-${width}-${theme}.png`),fullPage:true});
    await page.keyboard.press('Escape');
    await keep.waitFor({state:'detached'});
    assert.equal(await keep.count(),0,'Second Escape returns to editing');
    assert.ok(await title.evaluate(el=>document.activeElement===el));
    for(const key of ['Tab','Shift+Tab'])for(let i=0;i<30;i++){
      await page.keyboard.press(key);
      assert.ok(await dialog.evaluate(el=>el.contains(document.activeElement)),'Focus cannot leave the modal');
    }
    await title.fill(''); // Restore the original empty draft, with no persistent write.
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
    assert.ok(await trigger.evaluate(el=>document.activeElement===el),'Closing restores opener focus');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page horizontal overflow');
    assert.deepEqual(errors,[],'No browser runtime errors');
    console.log(`PASS ${width}px ${theme}: skip link, visitor keyboard menu, task initial focus, discard focus, Escape, Tab containment and focus restoration; no account or external request`);
    await context.close();
  }
} finally {
  if(browser)await browser.close();server.closeAllConnections();await new Promise(done=>server.close(done));
}
