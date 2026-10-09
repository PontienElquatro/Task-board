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
    const {data:actorStatus,error:statusError}=await backend.from('taskboard_account_status').select('suspended').eq('user_id',user.id).maybeSingle();
    if(statusError) throw statusError;
    if(actorStatus?.suspended) return reply(403,{error:'Account suspended'});
    const minuteAgo=new Date(Date.now()-60000).toISOString();
    const {count:recent,error:rateError}=await backend.from('taskboard_admin_audit').select('id',{count:'exact',head:true}).eq('actor_id',user.id).gte('created_at',minuteAgo);
    if (rateError) throw rateError;
    if ((recent ?? 0)>=30) return reply(429,{error:'Too many requests'});
    const raw=await req.text();
    if (raw.length>1024) return reply(413,{error:'Payload too large'});
    let body: {page?:number;action?:string;auditPage?:number;targetId?:string;reason?:string;expectedSuspended?:boolean;teamId?:string};
    try { body=raw ? JSON.parse(raw) : {}; } catch { return reply(400,{error:'Invalid JSON'}); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key=>!['page','action','auditPage','targetId','reason','expectedSuspended','teamId'].includes(key))) return reply(400,{error:'Invalid request'});
    if(body.action!==undefined && !['check_access','suspend','reactivate','collaboration','team_detail'].includes(body.action)) return reply(400,{error:'Invalid action'});
    if(body.action==='check_access') return reply(200,{isAdmin:true});
    if(body.action==='collaboration'||body.action==='team_detail'){
      const page=body.page??1;
      if(!Number.isSafeInteger(page)||page<1||page>10000)return reply(400,{error:'Invalid page'});
      const {error:consultationError}=await backend.from('taskboard_admin_audit').insert({actor_id:user.id,action:'dashboard_view'});
      if(consultationError)throw consultationError;
      if(body.action==='collaboration'){
        const result=await backend.from('taskboard_teams').select('id,name,owner_id,created_at',{count:'exact'}).order('created_at',{ascending:false}).order('id',{ascending:false}).range((page-1)*50,page*50-1);
        if(result.error)throw result.error;
        return reply(200,{teams:result.data??[],total:result.count??0,page});
      }
      if(typeof body.teamId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.teamId))return reply(400,{error:'Invalid team'});
      const team=await backend.from('taskboard_teams').select('id,name,owner_id,created_at').eq('id',body.teamId).maybeSingle();
      if(team.error)throw team.error;
      if(!team.data)return reply(404,{error:'Team not found'});
      const now=new Date().toISOString();
      const invitations=()=>backend.from('taskboard_team_invitations').select('id',{count:'exact',head:true}).eq('team_id',body.teamId);
      const counts=await Promise.all([
        backend.from('taskboard_team_members').select('user_id',{count:'exact',head:true}).eq('team_id',body.teamId),
        backend.from('taskboard_shared_projects').select('id',{count:'exact',head:true}).eq('team_id',body.teamId),
        invitations().not('accepted_at','is',null),
        invitations().is('accepted_at',null).gt('expires_at',now),
        invitations().is('accepted_at',null).lte('expires_at',now)
      ]);
      if(counts.some(result=>result.error))throw new Error('Incomplete team detail');
      return reply(200,{team:team.data,members:counts[0].count??0,projects:counts[1].count??0,accepted:counts[2].count??0,pending:counts[3].count??0,expired:counts[4].count??0});
    }
    if(body.action==='suspend'||body.action==='reactivate'){
      if(typeof body.targetId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.targetId)
        ||typeof body.reason!=='string'||body.reason.trim().length<10||body.reason.trim().length>500
        ||typeof body.expectedSuspended!=='boolean') return reply(400,{error:'Invalid account action'});
      if(body.targetId===user.id) return reply(403,{error:'Self action forbidden'});
      const {data:targetData,error:targetError}=await backend.auth.admin.getUserById(body.targetId);
      if(targetError||!targetData.user) return reply(404,{error:'Account not found'});
      const target=targetData.user;
      const {data:protectedRole,error:roleError}=await backend.from('taskboard_admin_allowlist').select('email').eq('email',(target.email??'').toLowerCase()).maybeSingle();
      if(roleError) throw roleError;
      if(protectedRole) return reply(403,{error:'Administrator accounts are protected'});
      const suspended=body.action==='suspend';
      const {data:auditId,error:mutationError}=await backend.rpc('taskboard_set_account_status',{
        actor:user.id,actor_email:user.email,target:target.id,target_email:target.email??'',
        new_suspended:suspended,expected_suspended:body.expectedSuspended,action_reason:body.reason.trim()
      });
      if(mutationError) return reply(mutationError.code==='PT409'?409:503,{error:'Account change rejected'});
      // Database gate is authoritative even while Auth synchronization fails.
      const {error:banError}=await backend.auth.admin.updateUserById(target.id,{ban_duration:suspended?'876000h':'none'});
      const {error:syncAuditError}=await backend.from('taskboard_admin_audit').update({auth_sync:banError?'failed':'success'}).eq('id',auditId);
      return reply(200,{suspended,warning:banError||syncAuditError?'Le statut est enregistré, mais la synchronisation Auth doit être vérifiée.':''});
    }
    const page=body?.page ?? 1;
    if (!Number.isSafeInteger(page) || page<1 || page>10000) return reply(400,{error:'Invalid page'});
    const auditPage=body.auditPage??1;
    if(!Number.isSafeInteger(auditPage)||auditPage<1||auditPage>10000) return reply(400,{error:'Invalid audit page'});
    const [accounts, countResult, roles]=await Promise.all([
      backend.auth.admin.listUsers({page:1,perPage:1000}),
      backend.from('taskboard_workspaces').select('user_id',{count:'exact',head:true}),
      backend.from('taskboard_admin_allowlist').select('email')
    ]);
    if (accounts.error || countResult.error || roles.error) throw new Error('Admin query failed');
    // Complete the directory before projecting it; never silently show partial global counts.
    if (accounts.data.total>10000) return reply(503,{error:'Directory capacity exceeded'});
    for(let next=2; accounts.data.users.length<accounts.data.total; next++) {
      const batch=await backend.auth.admin.listUsers({page:next,perPage:1000});
      if(batch.error || !batch.data.users.length) throw new Error('Incomplete directory');
      accounts.data.users.push(...batch.data.users);
    }
    const ids=accounts.data.users.map(account=>account.id);
    const spaces:{data:{user_id:string;updated_at:string}[]}={data:[]};
    for(let offset=0;offset<ids.length;offset+=500){
      const batch=await backend.from('taskboard_workspaces').select('user_id,updated_at').in('user_id',ids.slice(offset,offset+500));
      if(batch.error) throw batch.error;
      spaces.data.push(...(batch.data??[]));
    }
    const adminEmails=new Set((roles.data ?? []).map(row=>row.email));
    const updates=new Map((spaces.data ?? []).map(row=>[row.user_id,row.updated_at]));
    const suspendedIds=new Set<string>();
    for(let offset=0;offset<ids.length;offset+=500){
      const {data:statuses,error:statusesError}=await backend.from('taskboard_account_status').select('user_id,suspended').in('user_id',ids.slice(offset,offset+500));
      if(statusesError) throw statusesError;
      for(const row of statuses??[])if(row.suspended)suspendedIds.add(row.user_id);
    }
    // Explicit safe projection: no passwords, identities, tokens, metadata or private workspace data.
    const users=accounts.data.users.map(account=>({
      id:account.id,email:account.email ?? '',createdAt:account.created_at,
      lastSignIn:account.last_sign_in_at ?? null,confirmed:!!account.email_confirmed_at,
      admin:!!account.email_confirmed_at && adminEmails.has((account.email ?? '').toLowerCase()),
      updatedAt:updates.get(account.id) ?? null,suspended:suspendedIds.has(account.id)
    }));
    if(auditPage===1){
      const {error:auditError}=await backend.from('taskboard_admin_audit').insert({actor_id:user.id,action:'dashboard_view'});
      if (auditError) throw auditError;
    }
    const {data:events,count:auditTotal,error:eventsError}=await backend.from('taskboard_admin_audit').select('id,actor_id,action,created_at,target_id,reason,auth_sync',{count:'exact'}).order('created_at',{ascending:false}).order('id',{ascending:false}).range((auditPage-1)*30,auditPage*30-1);
    if (eventsError) throw eventsError;
    const {data:metrics,error:metricsError}=await backend.rpc('taskboard_admin_metrics');
    if(metricsError) throw metricsError;
    return reply(200,{users,total:users.length,page:1,workspaces:countResult.count ?? 0,events,auditPage,auditTotal:auditTotal??0,metrics,generatedAt:new Date().toISOString()});
  } catch {
    return reply(503,{error:'Admin service unavailable'});
  }
});
