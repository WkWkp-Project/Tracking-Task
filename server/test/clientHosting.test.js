import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { mountBuiltClient } from '../src/clientHosting.js';

test('the API server serves the built SPA and falls back to index.html', async (t) => {
  const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmhub-client-'));
  t.after(() => fs.rmSync(distDir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(distDir, 'index.html'), '<main>PM Hub production</main>');
  fs.writeFileSync(path.join(distDir, 'asset.txt'), 'asset');

  const app = express();
  assert.equal(mountBuiltClient(app, distDir), true);
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const asset = await fetch(`${base}/asset.txt`);
  assert.equal(await asset.text(), 'asset');
  const routeRefresh = await fetch(`${base}/auth/callback?code=test`);
  assert.equal(routeRefresh.status, 200);
  assert.match(await routeRefresh.text(), /PM Hub production/);
});

test('missing client build is reported without registering a broken fallback', () => {
  const app = express();
  assert.equal(mountBuiltClient(app, path.join(os.tmpdir(), 'missing-pmhub-build')), false);
});
