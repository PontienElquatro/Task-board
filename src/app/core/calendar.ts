export function localDayKey(date:Date):string {
 return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
}
export function calendarDays(year:number,month:number):(Date|null)[] {
 const offset=(new Date(year,month,1).getDay()+6)%7;
 const days:(Date|null)[]=Array.from({length:offset},()=>null);
 for(let day=1;day<=new Date(year,month+1,0).getDate();day++)days.push(new Date(year,month,day));
 while(days.length%7)days.push(null);
 return days;
}
export function calendarWeek(date:Date):Date[] {
 const offset=(date.getDay()+6)%7;
 return Array.from({length:7},(_,i)=>new Date(date.getFullYear(),date.getMonth(),date.getDate()-offset+i));
}

/** Planned dates are inclusive local days; dates never change workflow status. */
export function scheduledOn(task:{startDate?:Date;dueDate?:Date},day:Date):boolean {
 const start=task.startDate??task.dueDate,end=task.dueDate??task.startDate;
 return !!start&&!!end&&localDayKey(start)<=localDayKey(day)&&localDayKey(day)<=localDayKey(end);
}
export function validSchedule(start:string,end:string):boolean {
 return !start||!end||start<=end;
}
