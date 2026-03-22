import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { readDb, withDb } from '../lib/db.js';
import { signToken } from '../utils/token.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function toUserResponse(user) {
  return {
    id: user.id,
    username: user.username,
  };
}

router.post('/signup', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const normalizedUsername = String(username).trim().toLowerCase();
  if (normalizedUsername.length < 3) {
    return res.status(400).json({ error: 'username must be at least 3 chars' });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 chars' });
  }

  const existing = (await readDb()).users.find((u) => u.username === normalizedUsername);
  if (existing) {
    return res.status(409).json({ error: 'username already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: uuidv4(),
    username: normalizedUsername,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  await withDb(async (db) => {
    db.users.push(user);
  });

  const token = signToken(user);
  return res.status(201).json({
    token,
    user: toUserResponse(user),
    hasPasskey: false,
  });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const normalizedUsername = String(username).trim().toLowerCase();
  const db = await readDb();
  const user = db.users.find((u) => u.username === normalizedUsername);

  if (!user) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const token = signToken(user);
  const hasPasskey = db.passkeys.some((pk) => pk.userId === user.id);

  return res.json({
    token,
    user: toUserResponse(user),
    hasPasskey,
  });
});

router.get('/me', requireAuth, async (req, res) => {
  const db = await readDb();
  const hasPasskey = db.passkeys.some((pk) => pk.userId === req.user.id);

  return res.json({
    user: toUserResponse(req.user),
    hasPasskey,
  });
});

export default router;
