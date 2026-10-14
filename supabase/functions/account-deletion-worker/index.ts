import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const headers = {
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-worker-secret, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json',
  'Cache-Control':'no-store'
};
const reply = (status:number,data:unknown) => new Response(JSON.stringify(data),{status,headers});
const isUuid = (value:unknown): value is string => typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

async function cleanupAccount(backend:ReturnType<typeof createClient>,item:{user_id:string;claim_token:string}){
 const step=async(operation:string)=>{
  const result=await backend.rpc('taskboard_deletion_step',{account:item.user_id,token:item.claim_token,operation});
  if(result.error)throw result.error;
  return result.data;
 };
 try{
  await step('check');
  const ban=await backend.auth.admin.updateUserById(item.user_id,{ban_duration:'876000h'});
  if(ban.error)throw ban.error;
  let cleaned=false;
  for(let batch=0;batch<100;batch++){
   const objects=await step('objects');
   if(!Array.isArray(objects))throw new Error('Invalid storage batch');
   if(!objects.length){cleaned=true;break;}
   const buckets=new Map<string,string[]>();
   for(const object of objects){
    if(typeof object.bucket!=='string'||typeof object.name!=='string')throw new Error('Invalid storage object');
    buckets.set(object.bucket,[...(buckets.get(object.bucket)??[]),object.name]);
   }
   for(const [bucket,paths] of buckets){
    const removed=await backend.storage.from(bucket).remove(paths);
    if(removed.error)throw removed.error;
   }
  }
  if(!cleaned)throw new Error('Storage cleanup batch limit');
  await step('check');
  const deleted=await backend.auth.admin.deleteUser(item.user_id);
  if(deleted.error)throw deleted.error;
 }catch(error){
  try{await step('retry');}catch{/* Operator recovery keeps the reservation exclusive. */}
  throw error;
 }
}

Deno.serve(async (req:Request) => {
  if(req.method==='OPTIONS') return new Response('ok',{headers});
  if(req.method!=='POST') return reply(405,{error:'Method not allowed'});
  const supplied=req.headers.get('x-worker-secret');
  if(!supplied || supplied.length>256)
    return reply(401,{error:'Worker authentication required'});
  try {
    const url=Deno.env.get('SUPABASE_URL');
    const secretKeys=Deno.env.get('SUPABASE_SECRET_KEYS');
    const key=secretKeys ? JSON.parse(secretKeys).default : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!url || !key) return reply(503,{error:'Service not configured'});
    const backend=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const expected=Deno.env.get('ACCOUNT_DELETION_WORKER_SECRET');
    let executionEnabled=false;
    if(expected){
      if(supplied!==expected)return reply(401,{error:'Worker authentication required'});
      executionEnabled=Deno.env.get('ACCOUNT_DELETION_EXECUTE')==='true';
    }else{
      const verified=await backend.rpc('taskboard_verify_deletion_worker',{token:supplied});
      if(verified.error)throw verified.error;
      if(verified.data?.authorized!==true)return reply(401,{error:'Worker authentication required'});
      executionEnabled=verified.data.enabled===true;
    }
    const raw=await req.text();
    if(raw.length>256) return reply(413,{error:'Payload too large'});
    let body:{batchSize?:number}={};
    try { body=raw?JSON.parse(raw):{}; } catch { return reply(400,{error:'Invalid JSON'}); }
    if(!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(key=>key!=='batchSize') || (body.batchSize!==undefined && (!Number.isInteger(body.batchSize)||body.batchSize<1||body.batchSize>50)))
      return reply(400,{error:'Invalid request'});
    // Execution stays disabled until storage cleanup, session revocation and Auth deletion are validated.
    if(!executionEnabled) return reply(200,{mode:'disabled',claimed:[]});
    const {data,error}=await backend.rpc('taskboard_claim_account_deletions_v2',{batch_size:body.batchSize??10});
    if(error) throw error;
    if(!Array.isArray(data)||data.some(item=>!isUuid(item.user_id)||!isUuid(item.claim_token)))throw new Error('Invalid claims');
    const claimed=data;
    const completed:string[]=[];
    const failed:string[]=[];
    for(const item of claimed){
      const userId=item.user_id as string;
      try {
      await cleanupAccount(backend,item);
      completed.push(userId);
      } catch {
        failed.push(userId);
      }
    }
    return reply(failed.length?503:200,{mode:'executed',completed,failed});
  } catch { return reply(503,{error:'Worker unavailable'}); }
});
