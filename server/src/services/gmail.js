// Gmail send via the authenticated user's Google account.

import { google } from 'googleapis';
import { clientForUser, attachTokenPersistence, googleConfigured } from '../auth/google.js';

function buildRawEmail({ from, to, cc, subject, text, html }) {
  const boundary = 'pmhub_boundary_x';
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    cc ? `Cc: ${cc}` : null,
    `Subject: =?UTF-8?B?${Buffer.from(subject || '', 'utf8').toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);

  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    text || '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    html || `<pre style="font-family:inherit">${escapeHtml(text || '')}</pre>`,
    `--${boundary}--`,
  ].join('\r\n');

  const raw = `${headers.join('\r\n')}\r\n\r\n${body}`;
  return Buffer.from(raw, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

export async function sendEmail(user, { to, cc, subject, text, html }) {
  if (!googleConfigured) {
    const err = new Error('Google API not configured on the server.');
    err.code = 'GOOGLE_NOT_CONFIGURED';
    throw err;
  }
  if (!user.googleRefreshToken) {
    const err = new Error('This account has not linked Google yet. Login with Google first.');
    err.code = 'GOOGLE_NOT_LINKED';
    throw err;
  }
  const auth = attachTokenPersistence(clientForUser(user), user.id);
  const gmail = google.gmail({ version: 'v1', auth });
  const raw = buildRawEmail({ from: user.email, to, cc, subject, text, html });
  const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
  return { id: res.data.id, threadId: res.data.threadId };
}
