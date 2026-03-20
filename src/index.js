import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import passkeyRoutes from './routes/passkeys.js';
import { readDb } from './lib/db.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

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
