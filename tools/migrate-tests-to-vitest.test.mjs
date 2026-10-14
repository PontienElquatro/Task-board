import assert from 'node:assert/strict';
import { test } from 'node:test';
import { convertJasmine } from './migrate-tests-to-vitest.mjs';

test('preserves tests and assertions while converting spies, matchers and history', () => {
  const converted = convertJasmine(`
    let spy:jasmine.Spy;
    describe('example',()=>{
      it('keeps behavior',()=>{
        spy=jasmine.createSpy('name').and.returnValue('ok');
        spy('argument');
        expect(spy.calls.mostRecent().args[0]).toBe('argument');
        expect(spy.calls.count()===1).toBeTrue();
        spy.calls.reset();
      });
    });`);
  assert.deepEqual(converted.counts, {tests:1,assertions:2});
  for (const fragment of ['mockReturnValue', 'mock.lastCall!', 'mock.calls.length', 'mockClear()', 'toBe(true)']) assert.ok(converted.output.includes(fragment));
});

test('preserves arbitrary promise rejection checks and fake-clock boundaries', () => {
  const converted = convertJasmine(`
    it('rejects',async()=>{
      jasmine.clock().install();
      try {
        jasmine.clock().tick(5001);
        await expectAsync(Promise.reject(undefined)).toBeRejected();
      } finally {jasmine.clock().uninstall();}
    });`);
  assert.deepEqual(converted.counts, {tests:1,assertions:1});
  for (const fragment of ['useFakeTimers()', 'advanceTimersByTime(5001)', 'resolves.toBe(true)', 'useRealTimers()']) assert.ok(converted.output.includes(fragment));
});

test('maps static spy objects and refuses unsupported spy strategies before writing', () => {
  assert.ok(convertJasmine(`const obj=jasmine.createSpyObj('obj',['getItem','setItem']);`).output.includes('getItem: vi.fn()'));
  assert.throws(()=>convertJasmine(`jasmine.createSpy('x').and.callThrough();`), /unsupported spy strategy/);
});
