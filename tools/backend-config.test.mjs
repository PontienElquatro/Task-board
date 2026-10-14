import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectBackend } from './backend-config.mjs';

for (const [name, env] of [
  ['local', {}],
  ['preview', { VERCEL: '1', VERCEL_ENV: 'preview' }],
  ['development', { VERCEL: '1', VERCEL_ENV: 'development' }],
  ['local production build', { NODE_ENV: 'production' }],
  ['production label outside Vercel', { VERCEL_ENV: 'production' }]
]) {
  test(`${name} only uses the test project`, () => {
    assert.equal(selectBackend(env).url, 'https://fuvbwupoilkkawqhhdns.supabase.co');
  });
}
test('Vercel production preserves the production project', () => {
  assert.equal(selectBackend({ VERCEL: '1', VERCEL_ENV: 'production' }).url,
    'https://nzdfuhozeiexvtrryndk.supabase.co');
});
test('missing Vercel environment fails closed', () => {
  assert.throws(() => selectBackend({ VERCEL: '1' }), /Missing VERCEL_ENV/);
});
test('unknown environment fails closed', () => {
  assert.throws(() => selectBackend({ VERCEL: '1', VERCEL_ENV: 'staging' }), /Unknown VERCEL_ENV/);
});
