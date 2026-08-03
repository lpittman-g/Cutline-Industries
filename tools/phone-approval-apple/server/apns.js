import fs from 'node:fs';
import http2 from 'node:http2';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SECRETS = path.join(ROOT, 'secrets');

function readEnv(name, fileName) {
  if (process.env[name]?.trim()) return process.env[name].trim();
  const p = path.join(SECRETS, fileName);
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  return '';
}

export function loadConfig() {
  const keyId = readEnv('APPLE_KEY_ID', 'apple-key-id.txt');
  const teamId = readEnv('APPLE_TEAM_ID', 'apple-team-id.txt');
  const bundleId = readEnv('APPLE_BUNDLE_ID', 'apple-bundle-id.txt') || 'studio.cutlineindustries.approvalping';
  const production = (readEnv('APNS_PRODUCTION', 'apns-production.txt') || '0') === '1';
  let p8 = readEnv('APPLE_P8', 'AuthKey.p8');
  // Allow env to contain escaped newlines
  p8 = p8.replace(/\\n/g, '\n');
  const deviceToken = readEnv('APPLE_DEVICE_TOKEN', 'device-token.txt');
  return { keyId, teamId, bundleId, production, p8, deviceToken, secretsDir: SECRETS };
}

export function assertApnsReady(cfg = loadConfig()) {
  const missing = [];
  if (!cfg.keyId) missing.push('APPLE_KEY_ID (secrets/apple-key-id.txt)');
  if (!cfg.teamId) missing.push('APPLE_TEAM_ID (secrets/apple-team-id.txt)');
  if (!cfg.p8.includes('BEGIN PRIVATE KEY')) missing.push('APPLE_P8 / secrets/AuthKey.p8');
  if (!cfg.deviceToken) missing.push('APPLE_DEVICE_TOKEN (secrets/device-token.txt) — install iOS app once');
  if (missing.length) {
    const err = new Error(`Apple APNs not configured:\n- ${missing.join('\n- ')}`);
    err.code = 'APNS_NOT_CONFIGURED';
    throw err;
  }
  return cfg;
}

function makeProviderToken(cfg) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iss: cfg.teamId, iat: now },
    cfg.p8,
    { algorithm: 'ES256', header: { alg: 'ES256', kid: cfg.keyId } },
  );
}

/**
 * Send a visible alert push that opens the approval app.
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {object} [opts.data]
 * @param {string} [opts.deviceToken]
 */
export async function sendPush({ title, body, data = {}, deviceToken } = {}) {
  const cfg = assertApnsReady();
  const token = deviceToken || cfg.deviceToken;
  const host = cfg.production ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';
  const providerToken = makeProviderToken(cfg);

  const payload = {
    aps: {
      alert: { title, body },
      sound: 'default',
      'mutable-content': 1,
      'interruption-level': 'time-sensitive',
    },
    ...data,
  };

  const client = http2.connect(`https://${host}`);
  await new Promise((resolve, reject) => {
    client.on('error', reject);
    client.on('connect', resolve);
  });

  try {
    const resHeaders = {};
    let resBody = '';
    await new Promise((resolve, reject) => {
      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${token}`,
        authorization: `bearer ${providerToken}`,
        'apns-topic': cfg.bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'apns-expiration': '0',
        'content-type': 'application/json',
      });
      req.setEncoding('utf8');
      req.on('response', (h) => Object.assign(resHeaders, h));
      req.on('data', (c) => {
        resBody += c;
      });
      req.on('end', resolve);
      req.on('error', reject);
      req.end(JSON.stringify(payload));
    });

    const status = Number(resHeaders[':status'] || 0);
    if (status !== 200) {
      const err = new Error(`APNs error ${status}: ${resBody || 'no body'}`);
      err.status = status;
      err.body = resBody;
      throw err;
    }
    return {
      ok: true,
      apnsId: resHeaders['apns-id'],
      host,
      bundleId: cfg.bundleId,
    };
  } finally {
    client.close();
  }
}

export function saveDeviceToken(token) {
  const cleaned = String(token || '').replace(/\s+/g, '');
  if (!/^[0-9a-fA-F]{64,}$/.test(cleaned)) {
    throw new Error('device token must be hex (usually 64+ chars)');
  }
  fs.writeFileSync(path.join(SECRETS, 'device-token.txt'), cleaned + '\n', { mode: 0o600 });
  return cleaned;
}
