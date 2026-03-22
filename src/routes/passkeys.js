import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { requireAuth } from '../middleware/auth.js';
import { readDb, withDb } from '../lib/db.js';
import { env } from '../config/env.js';
import { fromBase64Url, toBase64Url } from '../utils/encoding.js';
import { signToken } from '../utils/token.js';

const router = Router();
const textEncoder = new TextEncoder();

function createChallengeRecord({ userId = null, username = null, type, challenge }) {
  return {
    id: uuidv4(),
    userId,
    username,
    type,
    challenge,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + env.challengeTtlMs).toISOString(),
  };
}

function getValidChallenge(db, challengeId, type) {
  const challenge = db.challenges.find((ch) => ch.id === challengeId && ch.type === type);
  if (!challenge) {
    return null;
  }

  if (Date.now() > new Date(challenge.expiresAt).getTime()) {
    return null;
  }

  return challenge;
}

function cleanupChallenges(db) {
  const now = Date.now();
  db.challenges = db.challenges.filter((ch) => new Date(ch.expiresAt).getTime() > now);
}

router.post('/register/options', requireAuth, async (req, res) => {
  const db = await readDb();
  const userPasskeys = db.passkeys.filter((pk) => pk.userId === req.user.id);

  const options = await generateRegistrationOptions({
    rpName: env.rpName,
    rpID: env.rpID,
    userName: req.user.username,
    userID: textEncoder.encode(req.user.id),
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    excludeCredentials: userPasskeys.map((pk) => ({
      id: fromBase64Url(pk.credentialID),
      transports: pk.transports || [],
    })),
  });

  const challengeRecord = createChallengeRecord({
    userId: req.user.id,
    username: req.user.username,
    type: 'register',
    challenge: options.challenge,
  });

  await withDb(async (mutableDb) => {
    cleanupChallenges(mutableDb);
    mutableDb.challenges.push(challengeRecord);
  });

  return res.json({
    challengeId: challengeRecord.id,
    options,
  });
});

router.post('/register/verify', requireAuth, async (req, res) => {
  const { challengeId, response } = req.body || {};

  if (!challengeId || !response) {
    return res.status(400).json({ error: 'challengeId and response are required' });
  }

  const db = await readDb();
  const challenge = getValidChallenge(db, challengeId, 'register');

  if (!challenge || challenge.userId !== req.user.id) {
    return res.status(400).json({ error: 'invalid or expired challenge' });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: env.origin,
      expectedRPID: env.rpID,
      requireUserVerification: false,
    });

    const { verified, registrationInfo } = verification;
    if (!verified || !registrationInfo) {
      return res.status(400).json({ verified: false, error: 'registration not verified' });
    }

    const credentialID = toBase64Url(registrationInfo.credentialID);
    const alreadyRegistered = db.passkeys.some((pk) => pk.credentialID === credentialID);
    if (alreadyRegistered) {
      return res.status(409).json({ error: 'credential already registered' });
    }

    await withDb(async (mutableDb) => {
      cleanupChallenges(mutableDb);
      mutableDb.challenges = mutableDb.challenges.filter((ch) => ch.id !== challengeId);
      mutableDb.passkeys.push({
        id: uuidv4(),
        userId: req.user.id,
        credentialID,
        credentialPublicKey: toBase64Url(registrationInfo.credentialPublicKey),
        counter: registrationInfo.counter,
        credentialDeviceType: registrationInfo.credentialDeviceType,
        credentialBackedUp: registrationInfo.credentialBackedUp,
        transports: response.response?.transports || [],
        createdAt: new Date().toISOString(),
      });
    });

    return res.json({ verified: true });
  } catch (error) {
    return res.status(400).json({ verified: false, error: error.message || 'registration verification failed' });
  }
});

router.post('/auth/options', async (req, res) => {
  const { username } = req.body || {};
  const normalizedUsername = username ? String(username).trim().toLowerCase() : null;
  const db = await readDb();

  let user = null;
  let allowCredentials = [];

  if (normalizedUsername) {
    user = db.users.find((u) => u.username === normalizedUsername) || null;
    if (!user) {
      return res.status(404).json({ error: 'user not found' });
    }

    const userPasskeys = db.passkeys.filter((pk) => pk.userId === user.id);
    if (userPasskeys.length === 0) {
      return res.status(400).json({ error: 'user has no registered passkeys' });
    }

    allowCredentials = userPasskeys.map((pk) => ({
      id: fromBase64Url(pk.credentialID),
      transports: pk.transports || [],
    }));
  }

  const options = await generateAuthenticationOptions({
    rpID: env.rpID,
    userVerification: 'preferred',
    allowCredentials,
  });

  const challengeRecord = createChallengeRecord({
    userId: user?.id || null,
    username: user?.username || null,
    type: 'authenticate',
    challenge: options.challenge,
  });

  await withDb(async (mutableDb) => {
    cleanupChallenges(mutableDb);
    mutableDb.challenges.push(challengeRecord);
  });

  return res.json({
    challengeId: challengeRecord.id,
    options,
  });
});

router.post('/auth/availability', async (req, res) => {
  const { username } = req.body || {};
  const normalizedUsername = username ? String(username).trim().toLowerCase() : null;

  if (!normalizedUsername) {
    return res.status(400).json({ error: 'username is required' });
  }

  const db = await readDb();
  const user = db.users.find((u) => u.username === normalizedUsername) || null;

  if (!user) {
    return res.json({ exists: false, hasPasskey: false });
  }

  const hasPasskey = db.passkeys.some((pk) => pk.userId === user.id);
  return res.json({ exists: true, hasPasskey });
});

router.post('/auth/verify', async (req, res) => {
  const { challengeId, response } = req.body || {};
  if (!challengeId || !response) {
    return res.status(400).json({ error: 'challengeId and response are required' });
  }

  const db = await readDb();
  const challenge = getValidChallenge(db, challengeId, 'authenticate');

  if (!challenge) {
    return res.status(400).json({ error: 'invalid or expired challenge' });
  }

  const credentialID = response.id;
  const passkey = db.passkeys.find((pk) => pk.credentialID === credentialID);

  if (!passkey) {
    return res.status(404).json({ error: 'passkey not found' });
  }

  const user = db.users.find((u) => u.id === passkey.userId);
  if (!user) {
    return res.status(404).json({ error: 'user not found for passkey' });
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: env.origin,
      expectedRPID: env.rpID,
      authenticator: {
        credentialID: fromBase64Url(passkey.credentialID),
        credentialPublicKey: fromBase64Url(passkey.credentialPublicKey),
        counter: passkey.counter,
        transports: passkey.transports || [],
      },
      requireUserVerification: false,
    });

    const { verified, authenticationInfo } = verification;

    if (!verified) {
      return res.status(401).json({ verified: false, error: 'authentication failed' });
    }

    await withDb(async (mutableDb) => {
      cleanupChallenges(mutableDb);
      mutableDb.challenges = mutableDb.challenges.filter((ch) => ch.id !== challengeId);

      const passkeyRef = mutableDb.passkeys.find((pk) => pk.id === passkey.id);
      if (passkeyRef) {
        passkeyRef.counter = authenticationInfo.newCounter;
      }
    });

    const token = signToken(user);
    return res.json({
      verified: true,
      token,
      user: { id: user.id, username: user.username },
      hasPasskey: true,
    });
  } catch (error) {
    return res.status(400).json({ verified: false, error: error.message || 'authentication verification failed' });
  }
});

export default router;
