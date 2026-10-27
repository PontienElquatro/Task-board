/** Keep the invitation secret in the fragment, outside HTTP requests. */
export function teamInvitationLink(origin: string, invitationId: string, token: string): string {
  const url = new URL('/team', origin);
  url.hash = new URLSearchParams({ invitation: invitationId, token }).toString();
  return url.href;
}

export function readTeamInvitation(fragment: string | null, query: { get(key: string): string | null }) {
  const params = fragment ? new URLSearchParams(fragment) : query;
  const id = params.get('invitation'), token = params.get('token');
  return id && token ? { id, token } : null;
}
