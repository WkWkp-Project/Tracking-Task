// Gmail send via the authenticated user's Google account.

import { google } from 'googleapis';
import { clientForUser, attachTokenPersistence, googleConfigured } from '../auth/google.js';

function buildRawEmail({ from, to, cc, bcc, subject, text, html, attachments = [] }) {
  const altBoundary = 'pmhub_alt_boundary_x';
  const mixedBoundary = 'pmhub_mixed_boundary_x';
  const files = (Array.isArray(attachments) ? attachments : []).map((file) => {
    const match = String(file?.url || '').match(/^data:([^;,]+)?;base64,(.+)$/s);
    if (!match) throw new Error('Invalid email attachment');
    return {
      name: String(file.name || 'attachment').replace(/[\r\n"]/g, '_').slice(0, 160),
      mimeType: String(file.mimeType || match[1] || 'application/octet-stream').replace(/[\r\n]/g, ''),
      base64: match[2].replace(/\s/g, ''),
    };
  });
  const totalBytes = files.reduce((sum, file) => sum + Buffer.from(file.base64, 'base64').length, 0);
  if (totalBytes > 3 * 1024 * 1024) throw new Error('Email attachments must total 3 MB or less');

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    cc ? `Cc: ${cc}` : null,
    bcc ? `Bcc: ${bcc}` : null,
    `Subject: =?UTF-8?B?${Buffer.from(subject || '', 'utf8').toString('base64')}?=`,
    'MIME-Version: 1.0',
    files.length
      ? `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`
      : `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
  ].filter(Boolean);

  const alternative = [
    `--${altBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    text || '',
    `--${altBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    html || `<pre style="font-family:inherit">${escapeHtml(text || '')}</pre>`,
    `--${altBoundary}--`,
  ];

  const body = files.length ? [
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    '',
    ...alternative,
    ...files.flatMap((file) => [
      `--${mixedBoundary}`,
      `Content-Type: ${file.mimeType}`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      '',
      file.base64.replace(/.{1,76}/g, '$&\r\n').trim(),
    ]),
    `--${mixedBoundary}--`,
  ].join('\r\n') : alternative.join('\r\n');

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

export async function sendEmail(user, { to, cc, bcc, subject, text, html, attachments }) {
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
  const raw = buildRawEmail({ from: user.email, to, cc, bcc, subject, text, html, attachments });
  const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
  return { id: res.data.id, threadId: res.data.threadId };
}
