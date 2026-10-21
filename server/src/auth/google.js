// Google OAuth2 + API client helpers.
// Everything here degrades gracefully when Google is not configured.

import { google } from 'googleapis';
import { config, googleConfigured } from '../config.js';
import db from '../db.js';

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events',
];

// True when the address belongs to `allowedDomain` or one of its subdomains
// (e.g. a@team.wkwkp.com for team.wkwkp.com). Lookalikes such as
// evil-team.wkwkp.com or team.wkwkp.com.evil.io are rejected.
export function isAllowedEmailDomain(email, allowedDomain) {
  if (!allowedDomain) return true;
  const domain = String(email || '').toLowerCase().split('@').pop();
  const allowed = String(allowedDomain).toLowerCase().replace(/^@/, '');
  return domain === allowed || domain.endsWith(`.${allowed}`);
}

export function hasRequiredScopes(scopeString, needed) {
  const granted = new Set(String(scopeString || '').split(/\s+/).filter(Boolean));
  return needed.every((scope) => granted.has(scope));
}

export function makeOAuthClient() {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

export function getAuthUrl(state) {
  const client = makeOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // always return a refresh token
    scope: GOOGLE_SCOPES,
    state,
    ...(config.google.allowedDomain ? { hd: config.google.allowedDomain } : {}),
  });
}

// Build an authorized client for a given user (uses their stored refresh token)
export function clientForUser(user) {
  if (!googleConfigured) throw new Error('GOOGLE_NOT_CONFIGURED');
  if (!user?.googleRefreshToken) throw new Error('GOOGLE_NOT_LINKED');
  const client = makeOAuthClient();
  client.setCredentials({ refresh_token: user.googleRefreshToken });
  return client;
}

// Persist refreshed access tokens automatically
export function attachTokenPersistence(client, userId) {
  client.on('tokens', (tokens) => {
    const patch = {};
    if (tokens.refresh_token) patch.googleRefreshToken = tokens.refresh_token;
    if (tokens.access_token) patch.googleAccessToken = tokens.access_token;
    if (Object.keys(patch).length) db.users.update(userId, patch);
  });
  return client;
}

export { googleConfigured };
