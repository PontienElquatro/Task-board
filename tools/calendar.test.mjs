import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/app/core/calendar.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
const {calendarDays,calendarWeek,localDayKey,scheduledOn,validSchedule}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const utils=await readFile(new URL('../src/app/models/task-utils.ts',import.meta.url),'utf8');
const utilsCode=ts.transpileModule(utils,{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
const {isOverdue}=await import('data:text/javascript;base64,'+Buffer.from(utilsCode).toString('base64'));
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

test('planned interval includes both endpoints across months',()=>{
 const task={startDate:new Date(2026,8,30,12),dueDate:new Date(2026,9,2,12)};
 for(const date of [new Date(2026,8,30),new Date(2026,9,1),new Date(2026,9,2)])assert.equal(scheduledOn(task,date),true);
 assert.equal(scheduledOn(task,new Date(2026,9,3)),false);
 assert.equal(scheduledOn(task,new Date(2026,8,29)),false);
});
test('single date remains compatible and undated tasks do not enter grid',()=>{
 const day=new Date(2026,9,5);
 assert.equal(scheduledOn({dueDate:day},day),true);
 assert.equal(scheduledOn({startDate:day},day),true);
 assert.equal(scheduledOn({},day),false);
});
test('optional dates and same-day schedules are valid, reversed dates are rejected',()=>{
 assert.equal(validSchedule('',''),true);
 assert.equal(validSchedule('2026-10-05',''),true);
 assert.equal(validSchedule('','2026-10-05'),true);
 assert.equal(validSchedule('2026-10-05','2026-10-05'),true);
 assert.equal(validSchedule('2026-10-06','2026-10-05'),false);
});

test('overdue starts after the last planned day and never marks completed tasks',()=>{
 const today=new Date(2026,9,5,23,59);
 assert.equal(isOverdue({status:'todo',dueDate:new Date(2026,9,5,12)},today),false);
 assert.equal(isOverdue({status:'in-progress',dueDate:new Date(2026,9,4,12)},today),true);
 assert.equal(isOverdue({status:'done',dueDate:new Date(2026,9,4,12)},today),false);
 assert.equal(isOverdue({status:'todo'},today),false);
});
