// Stateless, signed OAuth `state` values. Nothing is kept in server memory, so a
// restart (or a second server process) between "Sign in with Google" and the
// callback no longer breaks the login. The state is also bound to the browser
// through an httpOnly cookie in auth.routes.js (CSRF protection).

import crypto from 'node:crypto';
import { config } from '../config.js';

const sign = (data) =>
  crypto.createHmac('sha256', config.jwtSecret).update(`oauth-state:${data}`).digest('base64url');

export function createState(details, ttlMs, now = Date.now()) {
  const payload = { ...details, exp: now + ttlMs, n: crypto.randomBytes(8).toString('base64url') };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data)}`;
}

export function readState(state, now = Date.now()) {
  const [data, sig] = String(state || '').split('.');
  if (!data || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(data));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    return payload.exp > now ? payload : null;
  } catch {
    return null;
  }
}
