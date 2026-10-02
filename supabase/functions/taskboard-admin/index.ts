import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const headers = {
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json',
  'Cache-Control':'no-store'
};
const reply = (status:number, data:unknown) => new Response(JSON.stringify(data),{status,headers});
Deno.serve(async (req:Request) => {
  if (req.method === 'OPTIONS') return new Response('ok',{headers});
  if (req.method !== 'POST') return reply(405,{error:'Method not allowed'});
  const token=req.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return reply(401,{error:'Authentication required'});
  try {
    const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    const key=keys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!key) return reply(503,{error:'Service not configured'});
    const backend=createClient(Deno.env.get('SUPABASE_URL')!,key,{auth:{persistSession:false,autoRefreshToken:false}});
    // Validate with Auth on every call. Never trust email/user_metadata sent by the client.
    const {data:{user},error:authError}=await backend.auth.getUser(token);
    if (authError || !user) return reply(401,{error:'Invalid session'});
    if (!user.email_confirmed_at || !user.email) return reply(403,{error:'Confirmed administrator required'});
    const {data:allowed,error:permissionError}=await backend.from('taskboard_admin_allowlist').select('email').eq('email',user.email.toLowerCase()).maybeSingle();
    if (permissionError) throw permissionError;
    if (!allowed) return reply(403,{error:'Administrator required'});
    const minuteAgo=new Date(Date.now()-60000).toISOString();
    const {count:recent,error:rateError}=await backend.from('taskboard_admin_audit').select('id',{count:'exact',head:true}).eq('actor_id',user.id).gte('created_at',minuteAgo);
    if (rateError) throw rateError;
    if ((recent ?? 0)>=30) return reply(429,{error:'Too many requests'});
    const raw=await req.text();
    if (raw.length>1024) return reply(413,{error:'Payload too large'});
    let body: {page?:number};
    try { body=raw ? JSON.parse(raw) : {}; } catch { return reply(400,{error:'Invalid JSON'}); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key=>key!=='page')) return reply(400,{error:'Invalid request'});
    const page=body?.page ?? 1;
    if (!Number.isSafeInteger(page) || page<1 || page>10000) return reply(400,{error:'Invalid page'});
    const [accounts, countResult, roles]=await Promise.all([
      backend.auth.admin.listUsers({page,perPage:50}),
      backend.from('taskboard_workspaces').select('user_id',{count:'exact',head:true}),
      backend.from('taskboard_admin_allowlist').select('email')
    ]);
    if (accounts.error || countResult.error || roles.error) throw new Error('Admin query failed');
    const ids=accounts.data.users.map(account=>account.id);
    const spaces=ids.length ? await backend.from('taskboard_workspaces').select('user_id,updated_at').in('user_id',ids) : {data:[],error:null};
    if (spaces.error) throw spaces.error;
    const adminEmails=new Set((roles.data ?? []).map(row=>row.email));
    const updates=new Map((spaces.data ?? []).map(row=>[row.user_id,row.updated_at]));
    // Explicit safe projection: no passwords, identities, tokens, metadata or private workspace data.
    const users=accounts.data.users.map(account=>({
      id:account.id,email:account.email ?? '',createdAt:account.created_at,
      lastSignIn:account.last_sign_in_at ?? null,confirmed:!!account.email_confirmed_at,
      admin:!!account.email_confirmed_at && adminEmails.has((account.email ?? '').toLowerCase()),
      updatedAt:updates.get(account.id) ?? null
    }));
    const {error:auditError}=await backend.from('taskboard_admin_audit').insert({actor_id:user.id,action:'dashboard_view'});
    if (auditError) throw auditError;
    const {data:events,error:eventsError}=await backend.from('taskboard_admin_audit').select('id,actor_id,action,created_at').order('created_at',{ascending:false}).limit(30);
    if (eventsError) throw eventsError;
    return reply(200,{users,total:accounts.data.total,page,workspaces:countResult.count ?? 0,events});
  } catch {
    return reply(503,{error:'Admin service unavailable'});
  }
});
