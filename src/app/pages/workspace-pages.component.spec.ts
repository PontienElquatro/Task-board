import { calendarDays, localDayKey } from './workspace-pages.component';
import { routes } from '../app.routes';

describe('Nouvelles pages Ma’at',()=>{
 it('déclare les pages et une vraie page introuvable',()=>{
   for(const path of ['presentation','settings','projects','calendar','team','help','privacy','terms']) {
     expect(routes.find(route=>route.path===path)?.loadComponent).toBeDefined();
   }
   expect(routes.at(-1)?.path).toBe('**');
   expect(routes.at(-1)?.redirectTo).toBeUndefined();
 });
 it('conserve le tableau comme écran d’entrée',()=>{
   expect(routes.find(route=>route.path==='')?.redirectTo).toBe('board');
 });
 it('calcule un mois bissextile avec des semaines commençant le lundi',()=>{
   const days=calendarDays(2024,1);
   expect(days.length%7).toBe(0);
   expect(days.filter(Boolean).length).toBe(29);
   expect(days.slice(0,3)).toEqual([null,null,null]);
   expect(days[3]?.getDate()).toBe(1);
 });
 it('gère le passage à une nouvelle année',()=>{
   const days=calendarDays(2026,12).filter((day):day is Date=>day!==null);
   expect(days.length).toBe(31);
   expect(days[0].getFullYear()).toBe(2027);
 });
 it('utilise le jour local et non une conversion UTC',()=>{
   expect(localDayKey(new Date(2026,9,3,0,1))).toBe('2026-10-03');
   expect(localDayKey(new Date(2026,9,3,23,59))).toBe('2026-10-03');
 });
});
