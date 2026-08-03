#!/usr/bin/env node
/** Send a test ntfy approval notification. */
const API = process.env.CUTLINE_API_URL || 'http://127.0.0.1:8787';

const res = await fetch(`${API}/api/approval/request`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    service: 'Cutline Test',
    detail: 'If you see this on your iPhone ntfy app, approval lite works. Tap → Approve.',
    waitSeconds: 0,
  }),
});
const json = await res.json();
if (!res.ok) {
  console.error(json);
  process.exit(1);
}
console.log(JSON.stringify(json, null, 2));
