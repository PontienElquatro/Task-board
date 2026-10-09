import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/app/core/profile.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
const {profileName,profileNames,profileInitials}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('signup stores separate names and a backward-compatible full name',()=>{
 assert.deepEqual(profileNames('  Élodie ',' Martin '),{first_name:'Élodie',last_name:'Martin',full_name:'Élodie Martin',name:'Élodie Martin'});
 assert.throws(()=>profileNames('','Martin'));
 assert.throws(()=>profileNames('Camille',''));
 assert.throws(()=>profileNames('email@example.com','Martin'));
 assert.throws(()=>profileNames('X'.repeat(81),'Martin'));
});
test('existing aliases survive and email addresses never become display names',()=>{
 assert.equal(profileName({first_name:'Camille',last_name:'Martin',full_name:'Old alias'}),'Camille Martin');
 assert.equal(profileName({full_name:'TheQuatro'}),'TheQuatro');
 assert.equal(profileName({name:'Ancien profil'}),'Ancien profil');
 assert.equal(profileName({full_name:'user@example.com'}),'Membre');
 assert.equal(profileName({},'Mon compte'),'Mon compte');
});
test('initials use first and last words with accents and single-name compatibility',()=>{
 assert.equal(profileInitials('Élodie Marie Martin'),'ÉM');
 assert.equal(profileInitials('TheQuatro'),'TH');
 assert.equal(profileInitials(''),'M');
});
