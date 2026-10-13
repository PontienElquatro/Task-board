import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import Piscina from 'piscina';

const require = createRequire(import.meta.url);
test('legacy build and test dependencies are absent from the lockfile', async () => {
  const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url),'utf8'));
  for (const name of ['braces','karma','@angular-devkit/build-angular','webpack-dev-server','webpack-dev-middleware','sockjs','tinypool']) {
    assert.ok(!Object.keys(lock.packages).some(path=>path===`node_modules/${name}` || path.endsWith(`/node_modules/${name}`)), name);
  }
});

test('the patched cache policy retains normal HTTP caching behavior', () => {
  const CachePolicy = require('http-cache-semantics');
  const request = { url: 'https://example.test/maat', method: 'GET', headers: {} };
  const policy = new CachePolicy(request, { status: 200, headers: { 'cache-control': 'public, max-age=60' } });
  assert.equal(policy.satisfiesWithoutRevalidation(request), true);
});

test('the CLI MCP SDK client can be constructed without credentials or a connection', () => {
  const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
  assert.ok(new Client({ name: 'maat-security-smoke', version: '1.0.0' }));
});

test('Piscina does not inherit worker environment options from Object.prototype', async () => {
  assert.equal(Object.hasOwn(Object.prototype, 'env'), false);
  assert.equal(process.env.MAAT_SECURITY_PROTOTYPE_TEST, undefined);
  let pool;
  try {
    Object.defineProperty(Object.prototype, 'env', { configurable: true, value: { MAAT_SECURITY_PROTOTYPE_TEST: 'inherited' } });
    pool = new Piscina({ filename: fileURLToPath(new URL('./fixtures/security-worker.cjs', import.meta.url)), minThreads: 1, maxThreads: 1 });
    assert.equal(await pool.run(null), null);
  } finally {
    delete Object.prototype.env;
    if (pool) await pool.destroy();
  }
});
