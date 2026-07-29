import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { google } from 'googleapis';
import db from '../db.js';
import { config, googleConfigured } from '../config.js';
import { signToken, publicUser, requireAuth } from '../auth/jwt.js';
import { getAuthUrl, makeOAuthClient, GOOGLE_SCOPES } from '../auth/google.js';
import { newUser } from '../services/users.js';

const router = Router();

// ── Email + password login ──────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email & password required' });
  const user = db.users.findOne((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user || !user.passwordHash)
    return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.disabled) return res.status(403).json({ error: 'Account disabled' });
  res.json({ token: signToken(user), user: publicUser(user) });
});

// ── Current user ─────────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// ── Change own password ──────────────────────────────────────────────────────
router.post('/change-password', requireAuth, async (req, res) => {
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
});

// ── Google OAuth config status (for the UI to show/hide the button) ──────────
router.get('/google/status', (_req, res) => {
  res.json({ configured: googleConfigured, allowedDomain: config.google.allowedDomain || null });
});

// ── Start Google OAuth ───────────────────────────────────────────────────────
router.get('/google', (_req, res) => {
  if (!googleConfigured)
    return res.status(503).json({ error: 'Google login is not configured on the server.' });
  res.redirect(getAuthUrl('login'));
});

// ── Google OAuth callback ────────────────────────────────────────────────────
router.get('/google/callback', async (req, res) => {
  const redirectBack = (params) =>
    res.redirect(`${config.clientOrigin}/auth/callback?${new URLSearchParams(params)}`);

  if (!googleConfigured) return redirectBack({ error: 'google_not_configured' });
  const { code, error } = req.query;
  if (error || !code) return redirectBack({ error: error || 'no_code' });

  try {
    const client = makeOAuthClient();
    const { tokens } = await client.getToken(String(code));
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data: profile } = await oauth2.userinfo.get();
    const email = (profile.email || '').toLowerCase();

    if (config.google.allowedDomain && !email.endsWith(`@${config.google.allowedDomain}`))
      return redirectBack({ error: 'domain_not_allowed' });

    let user = db.users.findOne((u) => u.email.toLowerCase() === email);
    if (!user) {
      user = newUser({
        name: profile.name || email.split('@')[0],
        email,
        role: 'creative',
        avatarUrl: profile.picture || null,
      });
      db.users.insert(user);
    }
    db.users.update(user.id, {
      googleId: profile.id,
      googleRefreshToken: tokens.refresh_token || user.googleRefreshToken || null,
      googleAccessToken: tokens.access_token || null,
      avatarUrl: profile.picture || user.avatarUrl || null,
    });

    const token = signToken(db.users.byId(user.id));
    return redirectBack({ token });
  } catch (e) {
    console.error('[google/callback]', e.message);
    return redirectBack({ error: 'oauth_failed' });
  }
});

// ── Link Google to the currently logged-in account (re-uses same flow) ───────
router.get('/google/link', requireAuth, (req, res) => {
  if (!googleConfigured)
    return res.status(503).json({ error: 'Google not configured' });
  res.json({ url: getAuthUrl(`link:${req.user.id}`) });
});

export default router;
