import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {dirname,resolve,sep,basename} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dependencyRoot=resolve(process.env.MAAT_DEPENDENCY_ROOT||root);
const require=createRequire(resolve(dependencyRoot,'package.json'));
const postcss=require('postcss'),tailwind=require('@tailwindcss/postcss');

test('the production stylesheet explicitly registers application and entry sources',async()=>{
 const css=await readFile(resolve(root,'src/styles.css'),'utf8');
 assert.match(css,/@import "tailwindcss" source\(none\);/);
 assert.match(css,/@source "\.\/app";/);
 assert.match(css,/@source "\.\/index\.html";/);
});

test('generated UI utilities remain while unrelated files cannot add utilities',async()=>{
 await mkdir(resolve(root,'tmp'),{recursive:true});
 const fixture=await mkdtemp(resolve(root,'tmp/style-sources-'));
 try{
  await mkdir(resolve(fixture,'app'));
  await writeFile(resolve(fixture,'app/card.html'),'<div class="grid-cols-7 min-h-11 dark:bg-gray-900 sm:flex">Task</div>');
  await writeFile(resolve(fixture,'app/palette.ts'),'const palette = { todo: "bg-blue-50", done: "bg-emerald-50" };');
  await writeFile(resolve(fixture,'index.html'),'<div class="text-blue-600"></div>');
  await writeFile(resolve(fixture,'unrelated-output.html'),'<div class="bg-pink-950"></div>');
  const css=`@import "${require.resolve('tailwindcss/index.css').replaceAll('\\','/')}" source(none);\n@source "./app";\n@source "./index.html";`;
  const result=await postcss([tailwind({base:fixture,optimize:{minify:true}})]).process(css,{from:resolve(fixture,'styles.css')});
  for(const selector of ['.grid-cols-7','.min-h-11','.dark\\:bg-gray-900','.sm\\:flex','.bg-blue-50','.bg-emerald-50','.text-blue-600'])assert.ok(result.css.includes(selector),`Required ${selector}`);
  assert.ok(!result.css.includes('.bg-pink-950'),'Unregistered output must not affect production CSS');
 }finally{
  // Only the newly created fixture, never the workspace or dependency directory.
  assert.ok(resolve(fixture).startsWith(resolve(root,'tmp')+sep));
  assert.ok(basename(fixture).startsWith('style-sources-'));
  await rm(fixture,{recursive:true,force:true});
 }
});
