import { env } from './env.js';

const DEFAULT_ANDROID_FINGERPRINT =
  'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C';

export const DEFAULT_APP_ID = 'passapp';

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
    throw new Error('androidSha256CertFingerprint must be 32-byte SHA256 hex (colon-separated or plain hex)');
  }

  const b64url = Buffer.from(hex, 'hex').toString('base64url');
  return `android:apk-key-hash:${b64url}`;
}

function parseAppsFromEnv() {
  const raw = process.env.APPS_CONFIG;
  if (!raw) {
    return null;
  }

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('APPS_CONFIG must be a non-empty JSON array');
  }

  return parsed;
}

function buildDefaultApps() {
  return [
    {
      id: 'passapp',
      name: 'Passkey Demo App',
      androidPackageName: 'com.passapp',
      androidSha256CertFingerprint: DEFAULT_ANDROID_FINGERPRINT,
    },
    {
      id: 'noon',
      name: 'Noon Buyer App',
      androidPackageName: 'com.noon.buyerapp',
      androidSha256CertFingerprint: DEFAULT_ANDROID_FINGERPRINT,
    },
  ];
}

function finalizeAppConfig(app) {
  const id = String(app.id).trim().toLowerCase();
  const fingerprint = normalizeFingerprint(
    app.androidSha256CertFingerprint || DEFAULT_ANDROID_FINGERPRINT,
  );
  const androidApkKeyHashOrigin = fingerprintToApkKeyHashOrigin(fingerprint);

  return {
    id,
    name: app.name || id,
    androidPackageName: app.androidPackageName,
    androidSha256CertFingerprint: fingerprint,
    androidApkKeyHashOrigin,
    expectedOrigins: [env.origin, androidApkKeyHashOrigin],
  };
}

const appRegistry = new Map(
  (parseAppsFromEnv() || buildDefaultApps()).map((app) => {
    const config = finalizeAppConfig(app);
    if (!config.androidPackageName) {
      throw new Error(`App "${config.id}" is missing androidPackageName`);
    }
    return [config.id, config];
  }),
);

export function getAppConfig(appId) {
  const normalizedId = String(appId || DEFAULT_APP_ID)
    .trim()
    .toLowerCase();
  return appRegistry.get(normalizedId) || null;
}

export function getAllAppConfigs() {
  return Array.from(appRegistry.values());
}

export function getPasskeyAppId(passkey) {
  return passkey.appId || DEFAULT_APP_ID;
}

export function filterPasskeysForApp(passkeys, appId) {
  const normalizedId = String(appId || DEFAULT_APP_ID)
    .trim()
    .toLowerCase();
  return passkeys.filter((passkey) => getPasskeyAppId(passkey) === normalizedId);
}

export function buildAssetLinks() {
  return getAllAppConfigs().map((app) => ({
    relation: [
      'delegate_permission/common.get_login_creds',
      'delegate_permission/common.handle_all_urls',
    ],
    target: {
      namespace: 'android_app',
      package_name: app.androidPackageName,
      sha256_cert_fingerprints: [app.androidSha256CertFingerprint],
    },
  }));
}
