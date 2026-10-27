/** Public messages only; never expose raw provider messages or account existence. */
export function authErrorMessage(error: unknown, fallback: string): string {
  const value = error as { code?: string; status?: number; name?: string } | null;
  switch (value?.code) {
    case 'invalid_credentials': return 'Adresse email ou mot de passe incorrect. Vérifiez votre saisie ou utilisez « Mot de passe oublié ? ».';
    case 'email_not_confirmed': return 'Confirmez votre adresse email avec le lien reçu lors de l’inscription. Vérifiez aussi les courriers indésirables.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit': return 'Trop de tentatives rapprochées. Patientez quelques minutes avant de réessayer.';
    case 'otp_expired':
    case 'flow_state_expired':
    case 'flow_state_not_found':
    case 'session_not_found': return 'Ce lien a expiré ou a déjà été utilisé. Demandez un nouveau lien de récupération.';
    case 'same_password': return 'Choisissez un mot de passe différent du précédent.';
    case 'weak_password': return 'Choisissez un mot de passe plus robuste, avec au moins 12 caractères.';
  }
  if (value?.status === 429) return 'Trop de tentatives rapprochées. Patientez quelques minutes avant de réessayer.';
  if (value?.name === 'AuthRetryableFetchError' || error instanceof TypeError) return 'Impossible de joindre le service de connexion. Vérifiez votre connexion internet puis réessayez.';
  if (value?.status && value.status >= 500) return 'Le service de connexion est temporairement indisponible. Réessayez dans quelques instants.';
  return fallback;
}
