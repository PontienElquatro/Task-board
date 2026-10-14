export type Workspace = Record<string, unknown>;
export type MergeChoice = 'local' | 'remote';
export interface MergeConflict {
  token: string; key: string; id?: string; label: string;
  local: unknown; remote: unknown;
}
export interface WorkspaceMerge { data: Workspace; conflicts: MergeConflict[]; }
const collections = new Set(['mytaskboard_tasks','mytaskboard_projects','mytaskboard_goals']);
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));
  return value;
}
function equal(a: unknown,b: unknown) { return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b)); }
function entities(value: unknown): Map<string, unknown> | null {
  if (value === undefined) return new Map();
  if (!Array.isArray(value)) return null;
  const result = new Map<string,unknown>();
  for (const item of value) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || result.has(item.id)) return null;
    result.set(item.id,item);
  }
  return result;
}
function label(key:string,value:unknown,id?:string) {
  const title = value && typeof value === 'object' ? (value as Record<string,unknown>)['title'] : undefined;
  return typeof title === 'string' ? title : id ?? key;
}

/** Three-way, entity-level merge. Never guess when the same entity changed twice. */
export function mergeWorkspace(base:Workspace,local:Workspace,remote:Workspace):WorkspaceMerge {
  const data:Workspace = Object.create(null);
  const conflicts:MergeConflict[] = [];
  const keys = new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)]);
  function choose(key:string,b:unknown,l:unknown,r:unknown,id?:string):unknown {
    if (equal(l,r)) return l;
    if (equal(l,b)) return r;
    if (equal(r,b)) return l;
    conflicts.push({token:JSON.stringify([key,id ?? null]),key,id,label:label(key,l ?? r,id),local:l,remote:r});
    return l;
  }
  for (const key of keys) {
    const b=base[key],l=local[key],r=remote[key];
    const bm=entities(b),lm=entities(l),rm=entities(r);
    if (collections.has(key) && bm && lm && rm && Array.isArray(l) && Array.isArray(r)) {
      const merged:unknown[]=[];
      for (const id of new Set([...lm.keys(),...rm.keys(),...bm.keys()])) {
        const value=choose(key,bm.get(id),lm.get(id),rm.get(id),id);
        if (value !== undefined) merged.push(value);
      }
      data[key]=merged;
    } else {
      const value=choose(key,b,l,r);
      if (value !== undefined) data[key]=value;
    }
  }
  return {data,conflicts};
}

export function resolveWorkspaceMerge(merge:WorkspaceMerge,choices:Record<string,MergeChoice>):Workspace {
  const data:Workspace=JSON.parse(JSON.stringify(merge.data));
  for (const conflict of merge.conflicts) {
    const choice=choices[conflict.token];
    if (choice !== 'local' && choice !== 'remote') throw new Error('Choisissez une version pour chaque conflit.');
    const value=conflict[choice];
    if (conflict.id !== undefined) {
      const items=data[conflict.key] as Array<{id:string}>;
      const index=items.findIndex(item=>item.id===conflict.id);
      if (index>=0) items.splice(index,1);
      if (value !== undefined) items.splice(index>=0?index:items.length,0,JSON.parse(JSON.stringify(value)));
    } else if (value === undefined) delete data[conflict.key];
    else data[conflict.key]=JSON.parse(JSON.stringify(value));
  }
  return data;
}
