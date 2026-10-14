import { DeviceCheckpoint, WorkspaceEnvelope } from './workspace-envelope';

function record(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
export function validEnvelope(value:unknown):value is WorkspaceEnvelope{
 if(!record(value))return false;
 return Number.isSafeInteger(value['revision'])&&(value['revision'] as number)>=0&&
  typeof value['pending']==='boolean'&&record(value['data'])&&
  (value['base']===undefined||record(value['base']));
}
function canonical(value:unknown):unknown{
 if(Array.isArray(value))return value.map(canonical);
 if(record(value))return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)]));
 return value;
}
/** Never silently upload one of several different unsynchronised device drafts. */
export function checkpointRecovery(copies:DeviceCheckpoint[],account:string):{envelope:WorkspaceEnvelope;ambiguous:boolean}|undefined{
 const valid=copies.filter(copy=>record(copy)&&copy.account===account&&validEnvelope(copy.envelope));
 const pending=valid.filter(copy=>copy.envelope.pending);
 const saved=pending[0]??valid[0];
 if(!saved)return undefined;
 const selected=JSON.stringify(canonical(saved.envelope.data));
 return {envelope:JSON.parse(JSON.stringify(saved.envelope)),ambiguous:pending.some(copy=>JSON.stringify(canonical(copy.envelope.data))!==selected)};
}
