import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/app/core/collaboration/refresh-queue.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { RefreshQueue } = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));
const pause = () => new Promise(resolve => setTimeout(resolve, 40));
test('bursts trigger one read', async () => {
  let reads = 0;
  const q = new RefreshQueue(() => false, async () => { reads++; }, 1);
  q.request(); q.request(); q.request();
  await pause(); q.dispose();
  assert.equal(reads, 1);
});
test('events during a local write are deferred, not lost', async () => {
  let blocked = true, reads = 0;
  const q = new RefreshQueue(() => blocked, async () => { reads++; }, 1);
  q.request(); await pause();
  assert.equal(reads, 0);
  blocked = false; await pause(); q.dispose();
  assert.equal(reads, 1);
});
test('events during an in-flight read get a second serialized read', async () => {
  let release, reads = 0, active = 0, maxActive = 0;
  const q = new RefreshQueue(() => false, async () => {
    reads++; active++; maxActive = Math.max(maxActive, active);
    if (reads === 1) await new Promise(resolve => { release = resolve; });
    active--;
  }, 1);
  q.request(); await pause(); q.request(); release();
  await pause(); q.dispose();
  assert.equal(reads, 2); assert.equal(maxActive, 1);
});
test('changing project or destroying a view cancels queued reads', async () => {
  let reads = 0;
  const q = new RefreshQueue(() => false, async () => { reads++; }, 1);
  q.request(); q.dispose(); q.request(); await pause();
  assert.equal(reads, 0);
});
