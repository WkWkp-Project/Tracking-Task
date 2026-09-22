import fs from 'node:fs';
import path from 'node:path';
import express from 'express';

export function mountBuiltClient(app, distDir) {
  const indexFile = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexFile)) return false;
  app.use(express.static(distDir, { index: false }));
  app.get('*', (_req, res) => res.sendFile(indexFile));
  return true;
}
