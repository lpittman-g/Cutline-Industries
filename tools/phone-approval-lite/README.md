# Phone approval lite (Cutline default)

**This is our phone approval system.** We do not use Apple Developer or APNs.

## Stack

| Piece | Role |
|-------|------|
| **ntfy** (iOS app) | Free lock-screen push to your iPhone |
| **`/approve`** | Web page to Approve / Deny agent requests |
| **Generated device ID** | Pairs your phone in browser (not Apple serial) |
| **MCP `phone-approval-lite`** | Agent tool to request approvals |

## Quick setup

1. `.env` → optionally set `CUTLINE_NTFY_TOPIC=cutline-thermal-your-topic` (or let the API generate one)
2. iPhone → install **ntfy** → subscribe to topic from `curl localhost:8787/api/approval/status`
3. Safari → `https://cutline-industries.studio/approve` → Add to Home Screen
4. Cursor → enable MCP from `.cursor/mcp.json.example`

Full guide: [`docs/SETUP-NO-APPLE-DEV.md`](docs/SETUP-NO-APPLE-DEV.md)

```bash
npm run send-test
```

## Agent tools

- `approval_lite_status`
- `request_signin_approval_lite`
- `resolve_signin_approval_lite`

## Why not Apple Developer?

| Apple APNs | Cutline lite |
|------------|--------------|
| $99/year | Free |
| Mac + Xcode required | iPhone + ntfy app only |
| Native app build | Web + ntfy |

The `phone-approval-apple/` folder is archived and not used.
