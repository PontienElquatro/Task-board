import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/app/core/auth/tab-session.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
});
const { tabSessionOptions } = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
test('separate tabs keep distinct accounts and logout only clears its own storage', () => {
  const a = tabSessionOptions('maat-test', storage());
  const b = tabSessionOptions('maat-test', storage());
  assert.notEqual(a.storageKey, b.storageKey);
  a.storage.setItem(a.storageKey, 'account-A');
  b.storage.setItem(b.storageKey, 'account-B');
  a.storage.removeItem(a.storageKey);
  assert.equal(a.storage.getItem(a.storageKey), null);
  assert.equal(b.storage.getItem(b.storageKey), 'account-B');
});
test('reload restores tab session and PKCE verifier but uses a new broadcast key', () => {
  const tab = storage();
  const first = tabSessionOptions('maat-test', tab);
  first.storage.setItem(first.storageKey, 'account-A');
  first.storage.setItem(first.storageKey + '-code-verifier', 'verifier');
  const reloaded = tabSessionOptions('maat-test', tab);
  assert.notEqual(first.storageKey, reloaded.storageKey);
  assert.equal(reloaded.storage.getItem(reloaded.storageKey), 'account-A');
  assert.equal(reloaded.storage.getItem(reloaded.storageKey + '-code-verifier'), 'verifier');
});
test('different backends are isolated and server instances share no memory', () => {
  const tab = storage();
  const a = tabSessionOptions('backend-A', tab);
  const b = tabSessionOptions('backend-B', tab);
  a.storage.setItem(a.storageKey, 'account-A');
  assert.equal(b.storage.getItem(b.storageKey), null);
  const serverA = tabSessionOptions('server');
  const serverB = tabSessionOptions('server');
  assert.equal(serverA.persistSession, false);
  serverA.storage.setItem(serverA.storageKey, 'temporary');
  assert.equal(serverB.storage.getItem(serverB.storageKey), null);
});
test('unavailable storage falls back to instance memory, never shared localStorage', () => {
  const unavailable = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } };
  const a = tabSessionOptions('maat-test', unavailable);
  a.storage.setItem(a.storageKey, 'temporary');
  assert.equal(a.storage.getItem(a.storageKey), 'temporary');
  a.storage.removeItem(a.storageKey);
  assert.equal(a.storage.getItem(a.storageKey), null);
});
test('AuthService explicitly signs out only the current session', () => {
  const auth = readFileSync(new URL('../src/app/services/auth.service.ts', import.meta.url), 'utf8');
  assert.match(auth, /auth\.signOut\(\{ scope: 'local' \}\)/);
});
