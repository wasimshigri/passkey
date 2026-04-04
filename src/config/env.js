import dotenv from 'dotenv';

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function normalizeFingerprint(value) {
  return value
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

function fingerprintToApkKeyHashOrigin(fingerprint) {
  const normalized = normalizeFingerprint(fingerprint);
  const hex = normalized.replace(/:/g, '');

  if (!/^[0-9A-F]{64}$/.test(hex)) {
    throw new Error('ANDROID_SHA256_CERT_FINGERPRINT must be 32-byte SHA256 hex (colon-separated or plain hex)');
  }

  const b64url = Buffer.from(hex, 'hex').toString('base64url');
  return `android:apk-key-hash:${b64url}`;
}

export const env = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: required('JWT_SECRET'),
  rpName: process.env.RP_NAME || 'Passkey MVP',
  rpID: required('RP_ID'),
  origin: required('ORIGIN'),
  androidPackageName: process.env.ANDROID_PACKAGE_NAME || 'com.passapp',
  androidSha256CertFingerprint:
    process.env.ANDROID_SHA256_CERT_FINGERPRINT ||
    'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C',
  androidApkKeyHashOrigin: null,
  expectedOrigins: [],
  challengeTtlMs: Number(process.env.CHALLENGE_TTL_MS || 5 * 60 * 1000),
  dataFile: process.env.DATA_FILE || 'src/data/db.json',
};

env.androidApkKeyHashOrigin = fingerprintToApkKeyHashOrigin(env.androidSha256CertFingerprint);
env.expectedOrigins = [env.origin, env.androidApkKeyHashOrigin];
