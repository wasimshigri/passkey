import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import passkeyRoutes from './routes/passkeys.js';
import { readDb } from './lib/db.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/.well-known/assetlinks.json', (_req, res) => {
  return res
    .type('application/json')
    .json([
      {
        relation: [
          'delegate_permission/common.get_login_creds',
          'delegate_permission/common.handle_all_urls',
        ],
        target: {
          namespace: 'android_app',
          package_name: 'com.passapp',
          sha256_cert_fingerprints: [
            'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C',
          ],
        },
      },
    ]);
});

app.get('/health', async (_req, res) => {
  const db = await readDb();
  return res.json({
    ok: true,
    users: db.users.length,
    passkeys: db.passkeys.length,
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
