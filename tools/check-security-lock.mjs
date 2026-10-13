import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const lock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));
assert.equal(lock.lockfileVersion, 3);
for (const section of ['dependencies', 'devDependencies']) {
  assert.deepEqual(lock.packages[''][section], manifest[section], `${section} is out of sync`);
}
const required = {
  '@angular/cli': '21.2.26',
  '@angular/build': '21.2.26',
  '@angular/ssr': '21.2.26',
  '@angular/core': '21.2.25',
  '@angular/compiler-cli': '21.2.25',
  piscina: '5.3.2',
  '@modelcontextprotocol/sdk': '1.31.0',
  'http-cache-semantics': '4.3.0',
  vitest: '4.1.11',
  '@vitest/mocker': '4.1.11',
  '@vitest/browser-playwright': '4.1.11',
  playwright: '1.64.0',
};
for (const [name, version] of Object.entries(required)) {
  const installed = Object.entries(lock.packages)
    .filter(([path]) => path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`));
  assert.ok(installed.length, `Missing package: ${name}`);
  for (const [path, entry] of installed) {
    assert.equal(entry.version, version, `${path}: unexpected version; rerun the security review before updating this assertion`);
    assert.ok(entry.integrity, `${path}: missing package integrity`);
    console.log(`${path}: ${entry.version}`);
  }
}
for (const name of ['braces', 'karma', 'jasmine-core', '@angular-devkit/build-angular', 'webpack-dev-middleware', 'webpack-dev-server', 'sockjs', 'tinypool']) {
  assert.ok(!Object.keys(lock.packages).some(path => path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`)), `Legacy vulnerable dependency remains: ${name}`);
}
console.log('Security lock versions are consistent. This check does not replace npm audit or application tests.');
