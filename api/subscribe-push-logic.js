const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OWNER_EMAIL = 'carl.meyer.business@gmail.com';

// Confirms the bearer token is a live Supabase session for the owner
// account, so the service-role upsert below can't be reached by an
// unauthenticated caller.
export async function verifyOwner(authHeader, fetchImpl = fetch) {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return false;
  const r = await fetchImpl(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token },
  });
  if (!r.ok) return false;
  const user = await r.json();
  return user?.email === OWNER_EMAIL;
}

export function buildSubscribeUpsertRequest(app, endpoint, keys) {
  return {
    url: SUPABASE_URL + '/rest/v1/push_subscriptions?on_conflict=endpoint',
    options: {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({ app, endpoint, p256dh: keys.p256dh, auth: keys.auth }),
    },
  };
}
