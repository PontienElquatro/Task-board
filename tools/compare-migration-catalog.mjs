// Pure comparison. Reads no database and performs no writes/network requests.
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
 return value;
}
function equal(a,b){return JSON.stringify(canonical(a))===JSON.stringify(canonical(b));}
function index(rows,category){
 const result=new Map();
 for(const row of rows){
  if(typeof row.name!=='string'||result.has(row.name))throw new Error('Invalid or duplicate catalog key: '+category);
  result.set(row.name,row);
 }
 return result;
}
export function compareMigrationCatalog(reference,local){
 const differences={};
 let totalMissing=0,totalExtra=0,totalChanged=0;
 for(const category of Object.keys(reference).sort()){
  if(!Array.isArray(reference[category])||!Array.isArray(local[category]))throw new Error('Missing catalog category: '+category);
  const expected=index(reference[category],category),actual=index(local[category],category);
  const missing=[...expected.keys()].filter(k=>!actual.has(k)).sort();
  const extra=[...actual.keys()].filter(k=>!expected.has(k)).sort();
  const changed=[...expected.keys()].filter(k=>actual.has(k)&&!equal(expected.get(k),actual.get(k))).sort().map(name=>({name,
   fields:[...new Set([...Object.keys(expected.get(name)),...Object.keys(actual.get(name))])].filter(k=>!equal(expected.get(name)[k],actual.get(name)[k])).sort(),
   reference:expected.get(name),local:actual.get(name),
  }));
  differences[category]={referenceCount:expected.size,localCount:actual.size,missing,extra,changed};
  totalMissing+=missing.length;totalExtra+=extra.length;totalChanged+=changed.length;
 }
 return {matches:totalMissing===0&&totalExtra===0&&totalChanged===0,
  totals:{missing:totalMissing,extra:totalExtra,changed:totalChanged},differences,
  limitations:['Function hashes detect textual changes; a changed hash alone does not prove a behavioral difference.',
   'No user data, configuration row values, external secrets, deployed Edge Functions or live Realtime delivery are compared.',
   'Differences are not automatically approved; every deliberate omission or privilege change requires review.']};
}
