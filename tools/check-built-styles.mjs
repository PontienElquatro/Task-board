import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const directory = resolve(process.argv[2] ?? 'dist/my-task-board/browser');
const files = (await readdir(directory)).filter(name => /^styles(?:-[\w]+)?\.css$/.test(name));
assert.ok(files.length, `No global styles bundle in ${directory}`);
const css = (await Promise.all(files.map(name => readFile(resolve(directory, name), 'utf8')))).join('\n');
for (const selector of ['.bg-blue-600', '.text-blue-600', '.grid-cols-7', '.min-h-11', '.rounded-2xl', '.dark\\:bg-gray-900']) {
  assert.ok(css.includes(selector), `Missing Tailwind utility ${selector}: check PostCSS configuration and source detection`);
}
console.log('Global styles contain the required calendar, controls, layout and dark-mode utilities.');
