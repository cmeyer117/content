// Shared CRON_SECRET bearer check for the cron-style endpoints. The leading
// underscore keeps Vercel from deploying this file as its own function.
//
// Fails CLOSED. The old inline check was `header !== process.env.CRON_SECRET`,
// which passes when BOTH are undefined: CRON_SECRET exists in Production only
// while SUPABASE_SERVICE_ROLE_KEY exists in Preview too, so any preview
// deployment accepted an unauthenticated POST and wrote through the service
// role key (found 2026-09-29, confirmed live with a write-free probe).
import { timingSafeEqual } from 'node:crypto';

export function isAuthorizedCron(authorizationHeader, secret = process.env.CRON_SECRET) {
  if (typeof secret !== 'string' || secret.length === 0) return false; // unset or empty secret = nothing is authorized
  if (typeof authorizationHeader !== 'string' || !authorizationHeader.startsWith('Bearer ')) return false;
  const presented = Buffer.from(authorizationHeader.slice('Bearer '.length));
  const expected = Buffer.from(secret);
  return presented.length === expected.length && timingSafeEqual(presented, expected);
}
