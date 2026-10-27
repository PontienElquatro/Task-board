import { describe, expect, it } from 'vitest';
import { authErrorMessage } from './auth-errors';

describe('safe authentication messages', () => {
  it.each([
    ['invalid_credentials', 'Adresse email ou mot de passe incorrect'],
    ['email_not_confirmed', 'Confirmez votre adresse email'],
    ['over_request_rate_limit', 'Trop de tentatives'],
    ['over_email_send_rate_limit', 'Trop de tentatives'],
    ['otp_expired', 'Ce lien a expiré'],
    ['flow_state_expired', 'Ce lien a expiré'],
    ['session_not_found', 'Ce lien a expiré'],
    ['same_password', 'différent du précédent'],
    ['weak_password', 'plus robuste'],
  ])('explains %s without raw provider details', (code, expected) => {
    expect(authErrorMessage({code, message:'sensitive provider details'}, 'fallback')).toContain(expected);
  });
  it('distinguishes network, rate limit and service failures', () => {
    expect(authErrorMessage(new TypeError('private URL'), 'fallback')).toContain('connexion internet');
    expect(authErrorMessage({status:429}, 'fallback')).toContain('Trop de tentatives');
    expect(authErrorMessage({status:503}, 'fallback')).toContain('temporairement indisponible');
  });
  it('never displays unknown provider details or reveals account existence', () => {
    expect(authErrorMessage({code:'email_exists', message:'secret'}, 'fallback')).toBe('fallback');
    expect(authErrorMessage(null, 'fallback')).toBe('fallback');
  });
});
