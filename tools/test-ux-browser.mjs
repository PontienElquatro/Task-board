// Local, disposable browser contexts only. No live backend requests are allowed.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.MAAT_PLAYWRIGHT_PATH || 'playwright');
const origin=new URL(process.env.MAAT_TEST_URL || 'http://127.0.0.1:4200');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(origin.hostname),'Only a local build is allowed');
const output=new URL('../outputs/ux/',import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN || undefined,
  args:process.env.CHROME_BIN ? ['--disable-gpu','--disable-gpu-sandbox','--in-process-gpu'] : []});
try {
  for(const viewport of [{width:1440,height:1000},{width:768,height:1024},{width:390,height:844}]) {
    for(const theme of ['light','dark']) {
      const context=await browser.newContext({viewport,colorScheme:theme});
      await context.route('**/*',route=>new URL(route.request().url()).origin===origin.origin ? route.continue() : route.abort());
      await context.addInitScript(theme=>localStorage.setItem('mytaskboard_theme',theme),theme);
      const page=await context.newPage(); const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(new URL('/board',origin).href);
      await page.getByText('Mode local',{exact:true}).waitFor();
      await page.getByRole('button',{name:/Nouvelle tâche/}).click();
      await page.getByLabel('Titre (obligatoire)',{exact:true}).fill('Préparer le lancement de Ma’at');
      await page.getByRole('button',{name:'Créer la tâche',exact:true}).click();
      await page.getByRole('heading',{name:'Préparer le lancement de Ma’at',exact:true}).waitFor();
      await page.reload();
      await page.getByRole('heading',{name:'Préparer le lancement de Ma’at',exact:true}).waitFor();
      await page.getByLabel('Rechercher une tâche',{exact:true}).fill('introuvable');
      await page.getByRole('heading',{name:'Aucune tâche ne correspond.',exact:true}).waitFor();
      await page.getByRole('button',{name:'Effacer les filtres',exact:true}).click();
      await page.getByText('Filtres avancés',{exact:true}).click();
      await page.getByLabel('Filtrer par priorité',{exact:true}).selectOption('high');
      await page.getByRole('button',{name:'Afficher les résultats',exact:true}).click();
      await page.getByRole('button',{name:'Effacer les filtres',exact:true}).click();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page-level horizontal overflow');
      const summary=page.getByRole('button',{name:/Nouvelle tâche/});
      const size=await summary.boundingBox(); assert.ok(size.height>=44,'Primary touch target is at least 44px');
      await page.screenshot({path:fileURLToPath(new URL(`board-${viewport.width}-${theme}.png`,output)),fullPage:true});
      assert.deepEqual(errors,[],'No browser runtime errors');
      console.log(`PASS: ${viewport.width}px ${theme}: create, reload, search, filters, overflow, touch target`);
      await context.close();
    }
  }
} finally {await browser.close();}
