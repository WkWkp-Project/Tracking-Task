import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { config, googleConfigured, validateRuntimeConfig } from './config.js';
import db from './db.js';
import { initRealtime } from './realtime.js';
import { ensureSeed } from './seed.js';

import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import projectsRoutes from './routes/projects.routes.js';
import tasksRoutes from './routes/tasks.routes.js';
import chatRoutes from './routes/chat.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import googleRoutes from './routes/google.routes.js';
import workloadRoutes from './routes/workload.routes.js';
import adminRoutes from './routes/admin.routes.js';
import aeRoutes from './routes/ae.routes.js';
import brandsRoutes from './routes/brands.routes.js';
import { startScheduler } from './services/scheduler.js';
import { errorHandler } from './http.js';

validateRuntimeConfig();
await ensureSeed();

const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Resource-Policy': 'same-origin',
  });
  next();
});
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json({ limit: Math.ceil(config.chatAttachmentMaxBytes * 1.5) + 1024 }));

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, googleConfigured, time: new Date().toISOString() })
);

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/google', googleRoutes);
app.use('/api/workload', workloadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ae', aeRoutes);
app.use('/api/brands', brandsRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found', code: 'NOT_FOUND' });
});
app.use(errorHandler);

const server = http.createServer(app);
initRealtime(server);
startScheduler();

server.listen(config.port, () => {
  console.log('');
  console.log('  ┌───────────────────────────────────────────────┐');
  console.log(`  │  PM Hub API running on http://localhost:${config.port}    │`);
  console.log(`  │  Google integration: ${googleConfigured ? 'CONFIGURED ✓' : 'not configured'}            │`);
  console.log('  └───────────────────────────────────────────────┘');
  console.log('');
});

function shutdown() {
  console.log('\n[server] shutting down, flushing db...');
  db.flush();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
