import { sendPush, loadConfig, assertApnsReady } from './apns.js';

try {
  assertApnsReady();
  const cfg = loadConfig();
  const result = await sendPush({
    title: 'Cutline Agent',
    body: 'Apple APNs test — phone approval MCP is live.',
    data: { type: 'test' },
  });
  console.log(JSON.stringify({ ok: true, bundleId: cfg.bundleId, ...result }, null, 2));
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
