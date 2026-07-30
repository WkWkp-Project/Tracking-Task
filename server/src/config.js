import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// override:true so the backend's own .env wins over any PORT injected by a
// parent process (e.g. a preview/launcher that assigns PORT=5173 to the whole
// `npm run dev` tree — that value is meant for the Vite client, not the API).
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true });

export const config = {
  // dedicated var first, then .env PORT, then default — never inherit a
  // stray PORT meant for the client.
  port: Number(process.env.SERVER_PORT || process.env.PORT) || 4000,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  // chat messages are encrypted at rest with this key — set CHAT_ENCRYPTION_KEY
  // in production so a copy of db.json alone can't be read (even by an admin)
  chatEncryptionKey: process.env.CHAT_ENCRYPTION_KEY || 'dev-insecure-chat-key-change-me',
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@wkwkp.com',
    password: process.env.ADMIN_PASSWORD || 'admin1234',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ||
      'http://localhost:4000/api/auth/google/callback',
    allowedDomain: process.env.ALLOWED_GOOGLE_DOMAIN || '',
  },
};

export const googleConfigured = Boolean(
  config.google.clientId && config.google.clientSecret
);

// Capacity defaults used by the risk engine
export const WORK = {
  hoursPerDay: 8,        // default working capacity per person per day
  workdays: [1, 2, 3, 4, 5], // Mon..Fri (0 = Sunday)
  targetOnTimeProb: 0.85, // recommendation target: finish on time with >=85% confidence
};

export default config;
