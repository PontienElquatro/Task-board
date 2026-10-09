import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', {headers:cors});
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
    const body=await request.json() as {invitationId?:string;token?:string;teamName?:string;appUrl?:string};
    if(!body.invitationId||!body.token) throw new Error('Invitation incomplète.');
    const {data:invitation,error:invitationError}=await client.from('taskboard_team_invitations').select('id,email,role,token_hash,expires_at,team_id').eq('id',body.invitationId).eq('invited_by',user.id).single();
    if(invitationError||!invitation||invitation.token_hash!==body.token) throw new Error('Invitation introuvable.');
    if(new Date(invitation.expires_at).getTime()<=Date.now()) throw new Error('Cette invitation a expiré.');
    const appUrl=(body.appUrl||'https://task-board-gold-xi.vercel.app').replace(/\/$/,'');
    const acceptUrl=`${appUrl}/team?invitation=${encodeURIComponent(invitation.id)}&token=${encodeURIComponent(body.token)}`;
    const html=`<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#172033"><div style="color:#2563eb;font-size:20px;font-weight:700">Ma’at</div><h1 style="font-size:24px">Vous êtes invité dans ${escapeHtml(body.teamName||'une équipe Ma’at')}</h1><p>Vous avez été invité avec le rôle <strong>${escapeHtml(invitation.role)}</strong>.</p><p><a href="${acceptUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Accepter l’invitation</a></p><p style="font-size:12px;color:#64748b">Ce lien expire dans 7 jours.</p></div>`;
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:'Ma’at <onboarding@resend.dev>',to:[invitation.email],subject:`Invitation à rejoindre ${body.teamName||'une équipe Ma’at'}`,html})});
    if(!response.ok) { const details=await response.text(); console.error('Resend error',response.status,details); throw new Error(`Resend a refusé l’envoi (${response.status}). ${details.slice(0,240)}`); }
    return new Response(JSON.stringify({sent:true}),{headers:{...cors,'Content-Type':'application/json'}});
  } catch(error) { return new Response(JSON.stringify({sent:false,error:error instanceof Error?error.message:'Envoi impossible.'}),{status:200,headers:{...cors,'Content-Type':'application/json'}}); }
});
function escapeHtml(value:string){return value.replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]??char));}
