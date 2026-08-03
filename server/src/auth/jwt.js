import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import db from '../db.js';

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '30d' }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

// Strip sensitive fields before sending a user to the client
export function publicUser(u) {
  if (!u) return null;
  const { passwordHash, googleRefreshToken, googleAccessToken, ...rest } = u;
  return {
    ...rest,
    hasGoogle: Boolean(u.googleRefreshToken),
    hasPassword: Boolean(u.passwordHash),
  };
}

// Express middleware: require a valid bearer token
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token && verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  const user = db.users.byId(payload.sub);
  if (!user || user.disabled)
    return res.status(401).json({ error: 'Account is unavailable', code: 'ACCOUNT_UNAVAILABLE' });
  req.user = user;
  next();
}

// Express middleware: require admin role
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ error: 'Admin only', code: 'FORBIDDEN' });
  next();
}
