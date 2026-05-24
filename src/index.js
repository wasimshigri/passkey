import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { buildAssetLinks, getAllAppConfigs } from './config/apps.js';
import authRoutes from './routes/auth.js';
import passkeyRoutes from './routes/passkeys.js';
import { readDb } from './lib/db.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/.well-known/assetlinks.json', (_req, res) => {
  return res.type('application/json').json(buildAssetLinks());
});

app.get('/apps', (_req, res) => {
  return res.json({
    apps: getAllAppConfigs().map((app) => ({
      id: app.id,
      name: app.name,
      androidPackageName: app.androidPackageName,
      androidSha256CertFingerprint: app.androidSha256CertFingerprint,
    })),
  });
});

app.get('/health', async (_req, res) => {
  const db = await readDb();
  return res.json({
    ok: true,
    users: db.users.length,
    passkeys: db.passkeys.length,
    rpID: env.rpID,
    origin: env.origin,
    apps: getAllAppConfigs().map((app) => ({
      id: app.id,
      name: app.name,
      androidPackageName: app.androidPackageName,
      androidSha256CertFingerprint: app.androidSha256CertFingerprint,
    })),
    timestamp: new Date().toISOString(),
  });
});

app.use('/auth', authRoutes);
app.use('/passkeys', passkeyRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(env.port, () => {
  console.log(`Passkey MVP server running on http://localhost:${env.port}`);
});
