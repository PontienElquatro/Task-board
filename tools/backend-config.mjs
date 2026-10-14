const backends = {
  production: {
    url: 'https://nzdfuhozeiexvtrryndk.supabase.co',
    publishableKey: 'sb_publishable_Q0sTFsm0OJ3HRdKbhZd1gA_tuumvV3R'
  },
  test: {
    url: 'https://fuvbwupoilkkawqhhdns.supabase.co',
    publishableKey: 'sb_publishable_7YNYW3lUzzh4qOWYfquKqA_atTVR35v'
  }
};

/** Only Vercel's production environment may select the production backend. */
export function selectBackend(env = process.env) {
  const target = env.VERCEL_ENV;
  if (target && !['production', 'preview', 'development'].includes(target)) {
    throw new Error('Unknown VERCEL_ENV: refusing to select a backend.');
  }
  if (env.VERCEL === '1' && !target) {
    throw new Error('Missing VERCEL_ENV on Vercel: refusing to select a backend.');
  }
  const production = env.VERCEL === '1' && target === 'production';
  return { ...backends[production ? 'production' : 'test'], environment: production ? 'production' : 'test' };
}
