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
