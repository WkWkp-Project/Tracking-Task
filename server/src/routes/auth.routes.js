import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { google } from 'googleapis';
import db from '../db.js';
import { config, googleConfigured } from '../config.js';
import { signToken, publicUser, requireAuth } from '../auth/jwt.js';
import { getAuthUrl, makeOAuthClient } from '../auth/google.js';
import { newUser, ROLES } from '../services/users.js';
import { asyncRoute } from '../http.js';

const SELF_ROLES = ROLES.filter((role) => role !== 'admin');
const OAUTH_STATE_COOKIE = 'tracking_google_oauth_state';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const LOGIN_CODE_TTL_MS = 60 * 1000;
const pendingGoogleStates = new Map();
const pendingLoginCodes = new Map();
const failedLogins = new Map();
const router = Router();

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

function loginKey(req, email) {
  return `${req.ip || req.socket.remoteAddress || 'unknown'}:${String(email || '').toLowerCase()}`;
}

function checkLoginLimit(key) {
  const now = Date.now();
  const entry = failedLogins.get(key);
  if (!entry || entry.resetAt <= now) {
    failedLogins.delete(key);
    return false;
  }
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

function recordLoginFailure(key) {
  const now = Date.now();
  const current = failedLogins.get(key);
  const entry =
    current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + LOGIN_WINDOW_MS };
  entry.count += 1;
  failedLogins.set(key, entry);
}

function pruneOAuthEntries() {
  const now = Date.now();
  for (const [key, value] of pendingGoogleStates)
    if (value.expiresAt <= now) pendingGoogleStates.delete(key);
  for (const [key, value] of pendingLoginCodes)
    if (value.expiresAt <= now) pendingLoginCodes.delete(key);
}

function readCookie(req, name) {
  const prefix = `${encodeURIComponent(name)}=`;
  const item = String(req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : '';
}

function stateMatches(received, stored) {
  if (!received || !stored) return false;
  const a = Buffer.from(String(received));
  const b = Buffer.from(String(stored));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function googleCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.google.redirectUri.startsWith('https://'),
    path: '/api/auth/google',
  };
}

function beginGoogleFlow(res, details = {}) {
  pruneOAuthEntries();
  const state = crypto.randomBytes(32).toString('base64url');
  pendingGoogleStates.set(state, {
    ...details,
    expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
  });
  res.cookie(OAUTH_STATE_COOKIE, state, {
    ...googleCookieOptions(),
    maxAge: OAUTH_STATE_TTL_MS,
  });
  return state;
}

function clientOriginForRequest(req) {
  const fallback = config.clientOrigin;
  const source = req.get('origin') || req.get('referer');
  if (!source) return fallback;
  try {
    const candidate = new URL(source).origin;
    if (candidate === new URL(fallback).origin) return candidate;
    const host = new URL(candidate).hostname;
    if (process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(host))
      return candidate;
  } catch {
    // Ignore malformed browser headers and use the configured origin.
  }
  return fallback;
}

function redirectToClient(res, params, origin = config.clientOrigin) {
  const query = new URLSearchParams(params);
  return res.redirect(`${origin}/auth/callback?${query}`);
}

router.post('/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email & password required' });
  const key = loginKey(req, email);
  if (checkLoginLimit(key)) {
    return res.status(429).json({
      error: 'Too many failed login attempts. Try again later.',
      code: 'LOGIN_RATE_LIMITED',
    });
  }
  const user = db.users.findOne((item) => item.email.toLowerCase() === String(email).toLowerCase());
  if (!user || !user.passwordHash) {
    recordLoginFailure(key);
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    recordLoginFailure(key);
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (user.disabled) return res.status(403).json({ error: 'Account disabled' });
  failedLogins.delete(key);
  res.json({ token: signToken(user), user: publicUser(user) });
}));

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.post('/change-password', requireAuth, asyncRoute(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  if (req.user.passwordHash) {
    const ok = await bcrypt.compare(currentPassword || '', req.user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  db.users.update(req.user.id, { passwordHash });
  res.json({ ok: true });
}));

router.post('/set-role', requireAuth, (req, res) => {
  const { role } = req.body || {};
  if (!SELF_ROLES.includes(role)) return res.status(400).json({ error: 'invalid role' });
  // One-time onboarding gate only. Once a role is confirmed, changing it is an
  // admin action (PATCH /users/:id) — otherwise any worker could self-promote to PM.
  if (req.user.roleConfirmed) return res.status(403).json({ error: 'บทบาทถูกยืนยันแล้ว ให้แอดมินเปลี่ยนให้เท่านั้น' });
  db.users.update(req.user.id, { role, roleConfirmed: true });
  const updated = db.users.byId(req.user.id);
  res.json({ token: signToken(updated), user: publicUser(updated) });
});

router.get('/google/status', (_req, res) => {
  res.json({
    configured: googleConfigured,
    allowedDomain: config.google.allowedDomain || null,
    redirectUri: googleConfigured ? config.google.redirectUri : null,
  });
});

router.get('/google', (req, res) => {
  if (!googleConfigured)
    return res.status(503).json({ error: 'Google login is not configured on the server.' });
  const state = beginGoogleFlow(res, {
    mode: 'login',
    clientOrigin: clientOriginForRequest(req),
  });
  res.redirect(getAuthUrl(state));
});

router.get('/google/callback', asyncRoute(async (req, res) => {
  if (!googleConfigured) return redirectToClient(res, { error: 'google_not_configured' });
  const { code, error, state } = req.query;
  pruneOAuthEntries();
  const stateValue = String(state || '');
  const pendingState = pendingGoogleStates.get(stateValue);
  const clientOrigin = pendingState?.clientOrigin || config.clientOrigin;
  if (error || !code) {
    pendingGoogleStates.delete(stateValue);
    res.clearCookie(OAUTH_STATE_COOKIE, googleCookieOptions());
    return redirectToClient(res, { error: error || 'no_code' }, clientOrigin);
  }

  try {
    const cookieState = readCookie(req, OAUTH_STATE_COOKIE);
    pendingGoogleStates.delete(stateValue);
    res.clearCookie(OAUTH_STATE_COOKIE, googleCookieOptions());
    if (!pendingState || !stateMatches(stateValue, cookieState))
      return redirectToClient(res, { error: 'invalid_state' }, clientOrigin);

    const client = makeOAuthClient();
    const { tokens } = await client.getToken(String(code));
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data: profile } = await oauth2.userinfo.get();
    const email = (profile.email || '').toLowerCase();
    if (!email || profile.verified_email !== true)
      return redirectToClient(res, { error: 'email_not_verified' }, clientOrigin);
    if (config.google.allowedDomain && !email.endsWith(`@${config.google.allowedDomain}`))
      return redirectToClient(res, { error: 'domain_not_allowed' }, clientOrigin);

    let user;
    if (pendingState.mode === 'link') {
      user = db.users.byId(pendingState.userId);
      if (!user || user.email.toLowerCase() !== email)
        return redirectToClient(res, { error: 'account_mismatch' }, clientOrigin);
    } else {
      user = db.users.findOne((item) => item.email.toLowerCase() === email);
    }

    if (!user) {
      user = newUser({
        name: profile.name || email.split('@')[0],
        email,
        avatarUrl: profile.picture || null,
        roleConfirmed: false,
      });
      db.users.insert(user);
    }
    if (user.disabled) return redirectToClient(res, { error: 'account_disabled' }, clientOrigin);
    if (user.googleId && user.googleId !== profile.id)
      return redirectToClient(res, { error: 'google_account_conflict' }, clientOrigin);

    db.users.update(user.id, {
      googleId: profile.id,
      googleRefreshToken: tokens.refresh_token || user.googleRefreshToken || null,
      googleAccessToken: tokens.access_token || null,
      avatarUrl: profile.picture || user.avatarUrl || null,
    });

    const loginCode = crypto.randomBytes(32).toString('base64url');
    pendingLoginCodes.set(loginCode, {
      userId: user.id,
      expiresAt: Date.now() + LOGIN_CODE_TTL_MS,
    });
    return redirectToClient(res, { code: loginCode }, clientOrigin);
  } catch (err) {
    console.error('[google/callback]', err.message);
    return redirectToClient(res, { error: 'oauth_failed' }, clientOrigin);
  }
}));

router.post('/google/exchange', (req, res) => {
  pruneOAuthEntries();
  const code = String(req.body?.code || '');
  const pending = pendingLoginCodes.get(code);
  pendingLoginCodes.delete(code);
  if (!pending) return res.status(400).json({ error: 'Invalid or expired login code' });
  const user = db.users.byId(pending.userId);
  if (!user || user.disabled) return res.status(403).json({ error: 'Account unavailable' });
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/google/link', requireAuth, (req, res) => {
  if (!googleConfigured)
    return res.status(503).json({ error: 'Google not configured' });
  const state = beginGoogleFlow(res, {
    mode: 'link',
    userId: req.user.id,
    clientOrigin: clientOriginForRequest(req),
  });
  res.json({ url: getAuthUrl(state) });
});

export default router;
