// A fast, local-only diagnostic. No application accounts or browser profiles.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= resolve(root, 'tmp/playwright-browsers');
const { chromium } = await import('playwright');
const server = createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.end('<!doctype html><title>Browser diagnostic</title><script>' +
    'window.connected=false;const socket=new WebSocket("ws://"+location.host);' +
    'socket.onopen=()=>window.connected=true;</script>');
});
const sockets = new Set();
server.on('connection', socket => {
  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
});
server.on('upgrade', (request, socket) => {
  const key = request.headers['sec-websocket-key'];
  if (typeof key !== 'string') { socket.destroy(); return; }
  const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n' +
    'Connection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  console.log('Starting a fresh headless Chromium (60-second launch limit)...');
  browser = await chromium.launch({
    headless: true, timeout: 60_000,
    ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}),
  });
  console.log('Chromium started. Checking local HTTP and WebSocket...');
  const page = await browser.newPage();
  page.on('pageerror', error => console.error('Browser JavaScript:', error.message));
  page.on('requestfailed', request => console.error('Browser request:', request.failure()?.errorText));
  const response = await page.goto(`http://127.0.0.1:${server.address().port}`, { timeout: 30_000 });
  assert.equal(response.status(), 200);
  await page.waitForFunction(() => window.connected === true, null, { timeout: 30_000 });
  console.log('PASS: Chromium launch, local HTTP, JavaScript and WebSocket connection.');
} catch (error) {
  console.error('FAIL: browser diagnostic:', error.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  for (const socket of sockets) socket.destroy();
  await new Promise(resolve => server.close(resolve));
}
