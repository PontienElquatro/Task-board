export type NotificationEmail = { subject: string; html: string; text: string };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]!));
}

function safeLink(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Lien email invalide.');
  return url.href;
}

function layout(title: string, description: string, action: string, link: string, note: string): string {
  const href = escapeHtml(safeLink(link));
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#172033">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="padding:24px;background:#312e81;color:#ffffff;font-size:24px;font-weight:700">Ma’at</td></tr>
<tr><td style="padding:28px 24px"><h1 style="margin:0 0 18px;font-size:25px;line-height:1.3">${escapeHtml(title)}</h1>
<p style="font-size:16px;line-height:1.7;margin:0 0 24px">${escapeHtml(description)}</p>
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#4338ca" style="border-radius:10px"><a href="${href}" style="display:inline-block;padding:15px 22px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none">${escapeHtml(action)}</a></td></tr></table>
<p style="font-size:13px;line-height:1.6;color:#475569;margin:24px 0 0">${escapeHtml(note)}</p>
<p style="font-size:12px;line-height:1.6;color:#475569">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href="${href}" style="color:#4338ca;word-break:break-all">${href}</a></p></td></tr>
<tr><td style="padding:20px 24px;background:#312e81;color:#ffffff;font-size:12px;line-height:1.6">Ma’at by El_Quatro Technology<br>Un projet. Une prochaine action.</td></tr>
</table></td></tr></table></body></html>`;
}

export function invitationEmail(input: { teamName: string; role: string; acceptUrl: string; expiresAt: string }): NotificationEmail {
  const expiry = new Date(input.expiresAt);
  if (!Number.isFinite(expiry.getTime())) throw new Error('Expiration email invalide.');
  const link = safeLink(input.acceptUrl);
  const roles: Record<string, string> = { admin: 'administrateur', member: 'membre', viewer: 'observateur' };
  if (!Object.hasOwn(roles, input.role)) throw new Error('Rôle email invalide.');
  const role = roles[input.role];
  const title = `Vous êtes invité dans ${input.teamName}`;
  const description = `Rejoignez votre équipe dans Ma’at avec le rôle ${role}. Retrouvez vos projets et avancez ensemble, une tâche à la fois.`;
  const note = `Ce lien expire le ${expiry.toISOString().slice(0, 10)} à ${expiry.toISOString().slice(11, 16)} UTC. Si vous ne connaissez pas cette équipe, ignorez cette invitation.`;
  return { subject: `Invitation à rejoindre ${input.teamName}`.replace(/[\r\n]/g, ' '), html: layout(title, description, 'Accepter l’invitation', link, note), text: `${title}\n\n${description}\n\nAccepter l’invitation : ${link}\n\n${note}\n\nMa’at by El_Quatro Technology` };
}

// The future worker must authorize the recipient and allowlist appOrigin before calling this renderer.
// Do not include private task titles, descriptions or actor metadata in email previews.
export function assignmentEmail(appOrigin: string): NotificationEmail {
  const origin = new URL(safeLink(appOrigin));
  if (origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Origine email invalide.');
  const link = `${origin.origin}/team-projects`;
  const title = 'Une nouvelle tâche vous attend';
  const description = 'Une tâche ou une sous-tâche vous a été attribuée dans Ma’at. Connectez-vous pour consulter les détails et choisir votre prochaine action.';
  const note = 'Vous recevez cet email après avoir activé les notifications d’attribution. Vous pourrez les désactiver dans Paramètres → Notifications.';
  return { subject: 'Ma’at — une nouvelle tâche vous attend', html: layout(title, description, 'Voir mes projets d’équipe', link, note), text: `${title}\n\n${description}\n\nVoir mes projets d’équipe : ${link}\n\n${note}\n\nMa’at by El_Quatro Technology` };
}
