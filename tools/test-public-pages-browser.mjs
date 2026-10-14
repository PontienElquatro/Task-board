// Production-build visitor smoke: isolated contexts, no login or outbound email.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = resolve(root, process.argv[2] || 'dist/public-pages-check/browser');
assert.ok(build.startsWith(root + sep + 'dist' + sep));
const screenshots = resolve(root, 'tmp/public-pages-visual');
await mkdir(screenshots, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH ||= resolve(root, 'tmp/playwright-browsers');
const { chromium } = createRequire(import.meta.url)('playwright');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    let file = resolve(build, '.' + decodeURIComponent(path));
    if (file !== build && !file.startsWith(build + sep)) { res.writeHead(403); res.end(); return; }
    if (!extname(path)) file = resolve(build, 'index.csr.html');
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch { if (!res.headersSent) res.writeHead(404); res.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, timeout: 60000 });
  for (const [width, theme] of [[1440, 'light'], [390, 'light'], [390, 'dark']]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme });
    await context.addInitScript(value => {if(!localStorage.getItem('mytaskboard_theme'))localStorage.setItem('mytaskboard_theme', value);}, theme);
    await context.routeWebSocket('**/*', ws => ws.close());
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const path of ['home', 'presentation', 'about', 'contact', 'privacy', 'terms']) {
      await page.goto(`${origin}/${path}`);
      await page.locator('main h1').waitFor();
      assert.equal(await page.locator('main').count(), 1, `${path}: one main`);
      assert.equal(await page.locator('h1').count(), 1, `${path}: one h1`);
      assert.equal(await page.locator('app-public-header').count(), 1);
      assert.equal(await page.locator('app-public-footer').count(), 1);
      assert.equal(await page.locator('app-account-bar').count(), 0);
      assert.equal(await page.locator('app-workspace-nav').count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path}: horizontal overflow`);
      assert.equal(await page.locator('html').evaluate(el => el.classList.contains('dark')), theme === 'dark');
      if (path === 'home') {
        assert.ok(await page.getByText('Exemple illustratif', { exact: true }).isVisible());
        await page.screenshot({ path: resolve(screenshots, `home-${width}-${theme}.png`), fullPage: true });
        const brandChrome=()=>page.evaluate(()=>({
          header:getComputedStyle(document.querySelector('.visitor-header')).backgroundImage,
          footer:getComputedStyle(document.querySelector('.visitor-footer')).backgroundImage,
          cta:getComputedStyle(document.querySelector('.visitor-login')).backgroundColor,
          ink:getComputedStyle(document.querySelector('.visitor-login')).color
        }));
        const initial=await brandChrome();
        assert.match(initial.header,/linear-gradient/);assert.match(initial.footer,/linear-gradient/);
        assert.equal(initial.cta,'rgb(252, 211, 77)');assert.equal(initial.ink,'rgb(23, 37, 84)');
        const initiallyDark=theme==='dark';
        const toggle=page.getByRole('button',{name:initiallyDark?'Activer le thème clair':'Activer le thème sombre',exact:true});
        await toggle.focus();await page.keyboard.press('Enter');
        await page.waitForFunction(dark=>document.documentElement.classList.contains('dark')===dark,!initiallyDark);
        assert.deepEqual(await brandChrome(),initial,'Brand chrome and CTA stay fixed after theme toggle');
        await page.reload();await page.locator('main h1').waitFor();
        assert.equal(await page.locator('html').evaluate(el=>el.classList.contains('dark')),!initiallyDark,'Theme survives reload');
        await page.getByRole('button',{name:initiallyDark?'Activer le thème sombre':'Activer le thème clair',exact:true}).click();
        await page.waitForFunction(dark=>document.documentElement.classList.contains('dark')===dark,initiallyDark);
        assert.deepEqual(await brandChrome(),initial);
      }
      if (path === 'contact') {
        assert.equal(await page.locator('form').count(), 0);
        assert.match(await page.getByRole('link', { name: 'Écrire un email', exact: true }).getAttribute('href'), /^mailto:pontienmisenga93%40gmail\.com\?subject=/);
        await page.screenshot({ path: resolve(screenshots, `contact-${width}-${theme}.png`), fullPage: true });
      }
      await page.reload();
      await page.locator('main h1').waitFor();
      assert.equal(new URL(page.url()).pathname, '/' + path);
    }
    await page.goto(origin + '/');
    await page.getByRole('heading', { name: 'Moins de dispersion. Plus d’équilibre.', exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/home');
    const about = page.getByRole('navigation', { name: 'Navigation visiteurs' }).getByRole('link', { name: 'À propos', exact: true });
    await about.focus(); await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'L’équilibre commence par une prochaine action.', exact: true }).waitFor();
    assert.equal(await page.getByRole('navigation', { name: 'Navigation visiteurs' }).locator('[aria-current="page"]').getAttribute('href'), '/about');
    await page.getByRole('link', { name: 'Ouvrir le tableau', exact: true }).click();
    await page.getByRole('heading', { name: 'Mon tableau', exact: true }).waitFor();
    assert.equal(await page.locator('app-account-bar').count(), 1);
    assert.equal(await page.locator('app-public-header').count(), 0);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px ${theme}: six visitor routes + reload, fixed blue/indigo chrome, amber CTA, keyboard theme toggle + persistence, safe mailto and board CTA`);
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  server.closeAllConnections();
  await new Promise(done => server.close(done));
}
