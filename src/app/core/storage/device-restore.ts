import { Task } from '../../models';
import { normalizeTasks } from '../../models/task-utils';
export interface RestoreCopy { label:string; tasks:Task[]; }
export function readDeviceArchive(input:unknown,account:string):RestoreCopy[] {
  const archive=input as Record<string,unknown> | null;
  if(!archive || archive['app']!=='Maat' || archive['version']!==3 || archive['kind']!=='device-copies') throw new Error('Choisissez une archive Copies de cet appareil (version 3).');
  if(archive['accountId']!==account) throw new Error('Cette archive appartient à un autre compte ou espace local.');
  if(!Array.isArray(archive['copies']) || !Array.isArray(archive['journals']) || archive['copies'].length+archive['journals'].length>500) throw new Error('Liste de copies invalide ou trop volumineuse.');
  const result:RestoreCopy[]=[];
  const add=(value:unknown,label:string)=>{
    const envelope=value as {data?:Record<string,unknown>} | null;
    if(!envelope?.data || !Array.isArray(envelope.data['mytaskboard_tasks'])) throw new Error('Copie sans liste de tâches valide.');
    result.push({label,tasks:normalizeTasks(envelope.data['mytaskboard_tasks'])});
  };
  archive['copies'].forEach((value:unknown,index:number)=>{
    const copy=value as {account?:unknown;envelope?:unknown};
    if(!copy || copy.account!==account) throw new Error('Compte de copie incohérent.');
    add(copy.envelope,'Copie '+(index+1));
  });
  archive['journals'].forEach((value:unknown,index:number)=>add(value,'Brouillon '+(index+1)));
  if(!result.length) throw new Error('Cette archive ne contient aucune copie de tâches.');
  return result;
}
