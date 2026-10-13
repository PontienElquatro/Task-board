// Copies source/configuration into an owned, ignored verification directory.
// Never copies or changes the project's shared node_modules junction.
import assert from 'node:assert/strict';
import { cp, lstat, realpath, writeFile, readFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const folder = process.argv[2];
assert.match(folder ?? '', /^security-verification-[a-f0-9]{32}$/);
const stage = resolve(root, 'tmp', folder);
assert.equal((await lstat(stage)).isSymbolicLink(), false);
assert.ok((await lstat(stage)).isDirectory());
assert.ok((await realpath(stage)).startsWith(root + sep + 'tmp' + sep));
const manifest = JSON.parse(await readFile(resolve(stage, 'package.json'), 'utf8'));
assert.equal(manifest.name, 'my-task-board');
for (const file of [
  'package.json', 'package-lock.json', 'angular.json', 'tsconfig.json',
  'tsconfig.app.json', 'tsconfig.spec.json', 'tsconfig.backup-spec.json',
  'ngsw-config.json', '.postcssrc.json', 'vitest.config.mjs',
]) await cp(resolve(root, file), resolve(stage, file));
for (const folder of ['src', 'public', 'tools']) {
  await cp(resolve(root, folder), resolve(stage, folder), {recursive:true, dereference:false});
}
// Scripts and CI checks are copied, but no credentials, .env, .git or dependencies are copied.
await writeFile(resolve(stage, '.maat-security-verification'), 'Owned dependency-verification copy; never a production deployment.\n');
console.log(stage);
