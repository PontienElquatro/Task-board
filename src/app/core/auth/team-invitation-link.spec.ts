import { describe, it, expect } from 'vitest';
import { readTeamInvitation, teamInvitationLink } from './team-invitation-link';

describe('Private team invitation links', () => {
  it('round trips the secret in the fragment without query parameters', () => {
    const url = new URL(teamInvitationLink('https://maat.example', 'invitation-id', 'secret+&=#'));
    expect(url.origin).toBe('https://maat.example');
    expect(url.pathname).toBe('/team');
    expect(url.search).toBe('');
    expect(readTeamInvitation(url.hash.slice(1), url.searchParams)).toEqual({id:'invitation-id',token:'secret+&=#'});
  });
  it('continues to accept existing email links', () => {
    expect(readTeamInvitation(null, new URLSearchParams('invitation=id&token=secret'))).toEqual({id:'id',token:'secret'});
  });
  it('does not mix incomplete fragment and query credentials', () => {
    expect(readTeamInvitation('invitation=id', new URLSearchParams('token=secret'))).toBeNull();
    expect(readTeamInvitation(null, new URLSearchParams('invitation=id'))).toBeNull();
  });
});
