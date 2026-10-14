export const cardPalettes = [
 {id:'neutral',label:'Ma’at · neutre',family:'Neutre',swatches:['bg-slate-500','bg-slate-500','bg-slate-500'],tones:{'todo':['border-l-slate-500','bg-slate-50 dark:bg-slate-950'],'in-progress':['border-l-slate-500','bg-slate-50 dark:bg-slate-950'],'done':['border-l-slate-500','bg-slate-50 dark:bg-slate-950']}},
 {id:'classic',label:'Bleu · orange · vert',family:'Équilibrée',swatches:['bg-blue-500','bg-orange-500','bg-green-500'],tones:{'todo':['border-l-blue-500','bg-blue-50 dark:bg-blue-950'],'in-progress':['border-l-orange-500','bg-orange-50 dark:bg-orange-950'],'done':['border-l-green-500','bg-green-50 dark:bg-green-950']}},
 {id:'soft',label:'Violet · rose · turquoise',family:'Douce',swatches:['bg-violet-500','bg-rose-500','bg-teal-500'],tones:{'todo':['border-l-violet-500','bg-violet-50 dark:bg-violet-950'],'in-progress':['border-l-rose-500','bg-rose-50 dark:bg-rose-950'],'done':['border-l-teal-500','bg-teal-50 dark:bg-teal-950']}},
 {id:'electric',label:'Électrique',family:'Vive',swatches:['bg-cyan-500','bg-fuchsia-500','bg-lime-500'],tones:{'todo':['border-l-cyan-500','bg-cyan-50 dark:bg-cyan-950'],'in-progress':['border-l-fuchsia-500','bg-fuchsia-50 dark:bg-fuchsia-950'],'done':['border-l-lime-500','bg-lime-50 dark:bg-lime-950']}},
 {id:'sunset',label:'Coucher de soleil',family:'Vive',swatches:['bg-amber-500','bg-rose-500','bg-violet-500'],tones:{'todo':['border-l-amber-500','bg-amber-50 dark:bg-amber-950'],'in-progress':['border-l-rose-500','bg-rose-50 dark:bg-rose-950'],'done':['border-l-violet-500','bg-violet-50 dark:bg-violet-950']}},
 {id:'lagoon',label:'Lagon',family:'Vive',swatches:['bg-sky-500','bg-orange-500','bg-teal-500'],tones:{'todo':['border-l-sky-500','bg-sky-50 dark:bg-sky-950'],'in-progress':['border-l-orange-500','bg-orange-50 dark:bg-orange-950'],'done':['border-l-teal-500','bg-teal-50 dark:bg-teal-950']}},
 {id:'pastel',label:'Aquarelle',family:'Douce',swatches:['bg-indigo-500','bg-pink-500','bg-emerald-500'],tones:{'todo':['border-l-indigo-500','bg-indigo-50 dark:bg-indigo-950'],'in-progress':['border-l-pink-500','bg-pink-50 dark:bg-pink-950'],'done':['border-l-emerald-500','bg-emerald-50 dark:bg-emerald-950']}},
 {id:'sand',label:'Sable & sauge',family:'Neutre',swatches:['bg-stone-500','bg-amber-500','bg-emerald-500'],tones:{'todo':['border-l-stone-500','bg-stone-50 dark:bg-stone-950'],'in-progress':['border-l-amber-500','bg-amber-50 dark:bg-amber-950'],'done':['border-l-emerald-500','bg-emerald-50 dark:bg-emerald-950']}},
 {id:'graphite',label:'Graphite',family:'Neutre',swatches:['bg-slate-500','bg-zinc-500','bg-gray-500'],tones:{'todo':['border-l-slate-500','bg-slate-50 dark:bg-slate-950'],'in-progress':['border-l-zinc-500','bg-zinc-50 dark:bg-zinc-950'],'done':['border-l-gray-500','bg-gray-50 dark:bg-gray-950']}}
] as const;
export type Palette = typeof cardPalettes[number]['id'];
export function paletteClasses(palette:string,status:string,style:string):string {
 const choice=cardPalettes.find(p=>p.id===palette);
 if(!choice || palette==='neutral' || !['todo','in-progress','done'].includes(status))return 'bg-white dark:bg-gray-800';
 const [border,background]=choice.tones[status as 'todo'|'in-progress'|'done'];
 return 'border-l-4 '+border+' '+(style==='tinted'?background:'bg-white dark:bg-gray-800');
}
