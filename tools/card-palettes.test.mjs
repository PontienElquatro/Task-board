import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/app/core/card-palettes.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
const {cardPalettes,paletteClasses}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('nine unique palettes include vivid, soft and neutral choices',()=>{
 assert.equal(cardPalettes.length,9);
 assert.equal(new Set(cardPalettes.map(p=>p.id)).size,9);
 for(const family of ['Vive','Douce','Neutre'])assert.ok(cardPalettes.some(p=>p.family===family));
 for(const p of cardPalettes)assert.equal(p.swatches.length,3);
});
test('every palette supports all statuses and both styles with dark backgrounds',()=>{
 for(const palette of cardPalettes.filter(p=>p.id!=='neutral'))for(const status of ['todo','in-progress','done']){
  assert.match(paletteClasses(palette.id,status,'accent'),/border-l-4 border-l-\w+-500 bg-white dark:bg-gray-800/);
  assert.match(paletteClasses(palette.id,status,'tinted'),/bg-\w+-50 dark:bg-\w+-950/);
 }
});
test('old choices remain available and invalid input has a safe neutral fallback',()=>{
 for(const id of ['neutral','classic','soft'])assert.ok(cardPalettes.some(p=>p.id===id));
 assert.equal(paletteClasses('invalid','todo','tinted'),'bg-white dark:bg-gray-800');
 assert.equal(paletteClasses('classic','invalid','tinted'),'bg-white dark:bg-gray-800');
});
