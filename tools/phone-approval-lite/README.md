# Phone approval lite (no Apple Developer)

iPhone sign-in approvals **without** Apple Developer Program or device serial numbers.

Uses:
- **[ntfy](https://ntfy.sh)** — free push notifications to the ntfy iOS app
- **`/approve` web page** — Approve / Deny on your phone
- **Generated device ID** — stored in browser localStorage when you pair

Setup: [`docs/SETUP-NO-APPLE-DEV.md`](docs/SETUP-NO-APPLE-DEV.md)

MCP: `tools/phone-approval-lite/mcp/server.js`

For native APNs (after Apple Developer enrollment): see [`../phone-approval-apple/`](../phone-approval-apple/).
