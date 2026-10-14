import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { invitationEmail } from "../_shared/notification-email.ts";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', {headers:cors});
  if (request.method !== 'POST') return new Response(JSON.stringify({error:'Méthode non autorisée.'}),{status:405,headers:{...cors,'Content-Type':'application/json'}});
  try {
    const supabaseUrl=Deno.env.get('SUPABASE_URL')!;
    const supabaseKey=Deno.env.get('SUPABASE_ANON_KEY')!;
    const resendKey=Deno.env.get('RESEND_API_KEY');
    if(!resendKey) throw new Error('RESEND_API_KEY manquante.');
    const auth=request.headers.get('Authorization');
    if(!auth) return new Response(JSON.stringify({error:'Authentification requise.'}),{status:401,headers:{...cors,'Content-Type':'application/json'}});
    const client=createClient(supabaseUrl,supabaseKey,{global:{headers:{Authorization:auth}}});
    const {data:{user},error:userError}=await client.auth.getUser();
    if(userError||!user) return new Response(JSON.stringify({error:'Session invalide.'}),{status:401,headers:{...cors,'Content-Type':'application/json'}});
    const raw=await request.text();
    if(new TextEncoder().encode(raw).length>2048) throw new Error('Demande trop volumineuse.');
    const body=JSON.parse(raw) as {invitationId?:string;token?:string;teamName?:string;appUrl?:string};
    if(!body||typeof body.invitationId!=='string'||typeof body.token!=='string'||body.token.length<64||body.token.length>256||! /^[0-9a-f-]{36}$/i.test(body.invitationId)) throw new Error('Invitation incomplète.');
    const appUrl=invitationOrigin(body.appUrl);
    if(!user.email_confirmed_at) throw new Error('Confirmez votre adresse email.');
    const {data:invitation,error:invitationError}=await client.from('taskboard_team_invitations').select('id,email,role,token_hash,expires_at,accepted_at,team_id').eq('id',body.invitationId).eq('invited_by',user.id).single();
    if(invitationError||!invitation||invitation.token_hash!==body.token) throw new Error('Invitation introuvable.');
    if(invitation.accepted_at||new Date(invitation.expires_at).getTime()<=Date.now()) throw new Error('Cette invitation a expiré ou a déjà été acceptée.');
    const {data:team,error:teamError}=await client.from('taskboard_teams').select('name,owner_id').eq('id',invitation.team_id).single();
    const {data:canManage,error:permissionError}=await client.rpc('taskboard_manage_team',{tid:invitation.team_id});
    if(teamError||!team||permissionError||canManage!==true||(invitation.role==='admin'&&team.owner_id!==user.id)) throw new Error('Accès à cette invitation refusé.');
    const teamName=team.name;
    const acceptUrl=`${appUrl}/team?invitation=${encodeURIComponent(invitation.id)}&token=${encodeURIComponent(body.token)}`;
    const email=invitationEmail({teamName,role:invitation.role,acceptUrl,expiresAt:invitation.expires_at});
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json','Idempotency-Key':`team-invitation/${invitation.id}`},body:JSON.stringify({from:'Ma’at <onboarding@resend.dev>',to:[invitation.email],...email})});
    if(!response.ok) { console.error('Resend error',response.status); throw new Error('Le service email est indisponible. Réessayez plus tard.'); }
    return new Response(JSON.stringify({sent:true}),{headers:{...cors,'Content-Type':'application/json'}});
  } catch(error) { return new Response(JSON.stringify({sent:false,error:error instanceof Error?error.message:'Envoi impossible.'}),{status:200,headers:{...cors,'Content-Type':'application/json'}}); }
});
function invitationOrigin(value:unknown){
 const canonical='https://task-board-gold-xi.vercel.app';
 const url=new URL(typeof value==='string'?value:canonical);
 const configured=(Deno.env.get('APP_ALLOWED_ORIGINS')||'').split(',').map(origin=>origin.trim()).filter(Boolean);
 const preview=/^task-board-v1-[a-z0-9]+-pontien-misengas-projects\.vercel\.app$/.test(url.hostname);
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash||(!preview&&url.origin!==canonical&&!configured.includes(url.origin))) throw new Error('Origine du lien non autorisée.');
 return url.origin;
}
