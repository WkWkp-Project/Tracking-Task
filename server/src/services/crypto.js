// At-rest encryption for chat message bodies (AES-256-GCM). Keeps plaintext
// out of db.json — direct file/DB inspection (including by an admin) only
// sees ciphertext. Not end-to-end: the server still holds the key and can
// decrypt to serve messages to their participants.

import crypto from 'node:crypto';
import { config } from '../config.js';

const ALGO = 'aes-256-gcm';
const key = crypto.createHash('sha256').update(config.chatEncryptionKey).digest();

export function encryptText(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, enc]).toString('base64');
}

export function decryptText(blob) {
  try {
    const buf = Buffer.from(blob, 'base64');
    const iv = buf.subarray(0, 12);
    const authTag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return ''; // corrupt/foreign data — fail closed rather than throw
  }
}
