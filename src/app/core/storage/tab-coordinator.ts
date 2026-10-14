export interface SyncNotice {account:string;writer:string;}
export function validNotice(value:unknown):value is SyncNotice {
  if(!value||typeof value!=='object')return false;
  const notice=value as SyncNotice;
  return typeof notice.account==='string' && notice.account.length<=200 &&
    typeof notice.writer==='string' && notice.writer.length<=200;
}
export async function withWorkspaceLock<T>(account:string,work:()=>Promise<T>,locks:LockManager|null|undefined=navigator.locks):Promise<T> {
  return locks ? locks.request('maat-cloud-sync:'+account,{mode:'exclusive'},work) : work();
}
export const WORKSPACE_LOCKS=new InjectionToken<LockManager|null>('WorkspaceLocks',{providedIn:'root',factory:()=>navigator.locks ?? null});
import { InjectionToken } from '@angular/core';
