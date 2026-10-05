import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/app/core/calendar.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
const {calendarDays,calendarWeek,localDayKey}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('month handles leap years and Monday padding',()=>{
 const days=calendarDays(2024,1);
 assert.equal(days.filter(Boolean).length,29);
 assert.equal(days.length%7,0);
 assert.deepEqual(days.slice(0,3),[null,null,null]);
});
test('week crosses year boundary without changing cursor',()=>{
 const cursor=new Date(2027,0,1,23,59);
 const week=calendarWeek(cursor);
 assert.equal(localDayKey(week[0]),'2026-12-28');
 assert.equal(localDayKey(week[6]),'2027-01-03');
 assert.equal(cursor.getHours(),23);
 assert.equal(week.length,7);
});
test('Sunday belongs to the preceding Monday and keys use local dates',()=>{
 assert.equal(localDayKey(calendarWeek(new Date(2026,9,4))[0]),'2026-09-28');
 assert.equal(localDayKey(new Date(2026,9,3,0,1)),'2026-10-03');
 assert.equal(localDayKey(new Date(2026,9,3,23,59)),'2026-10-03');
});
