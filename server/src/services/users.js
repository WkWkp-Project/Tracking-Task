import bcrypt from 'bcryptjs';

export const ROLES = ['admin', 'pm', 'creative', 'copywriter', 'video', 'ae'];

const COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0d9488', '#65a30d', '#9333ea', '#0891b2'];

let colorCursor = 0;
function nextColor() {
  const c = COLORS[colorCursor % COLORS.length];
  colorCursor++;
  return c;
}

export function newUser({ name, email, role = 'creative', avatarUrl = null, capacityHoursPerDay = 8 }) {
  return {
    id: `usr_${Date.now()}_${Math.floor(Math.random() * 1e4)}`,
    name: name || email,
    email: String(email).toLowerCase(),
    role: ROLES.includes(role) ? role : 'creative',
    capacityHoursPerDay: Number(capacityHoursPerDay) || 8,
    avatarUrl,
    avatarColor: nextColor(),
    passwordHash: null,
    googleId: null,
    googleRefreshToken: null,
    googleAccessToken: null,
    disabled: false,
    online: false,
    lastSeen: null,
    createdAt: new Date().toISOString(),
  };
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}
