# Device approval without Apple Developer

Cutline's **own** approval system — no $99/year Apple Developer Program, **no serial numbers**.

## Why not serial numbers?

| Approach | Works? |
|----------|--------|
| iPhone serial number | **No** — apps can't read it for push; Apple doesn't allow it for notifications |
| Apple Developer + APNs | **Yes** — native lock-screen push (see `tools/phone-approval-apple/`) |
| **Cutline lite (this doc)** | **Yes** — ntfy app + web approve page + generated device ID |

We identify your phone with a **random device ID** stored in the browser — same idea as "pair this device" but not tied to Apple hardware serials.

## Setup (5 minutes)

### 1. Choose an ntfy topic

In spawn-channel `.env`:

```bash
CUTLINE_NTFY_TOPIC=cutline-thermal-your-topic
CUTLINE_PUBLIC_URL=https://cutline-industries.studio
```

If you leave `CUTLINE_NTFY_TOPIC` unset, the API will generate and persist one for you. You can always copy the current topic from `/api/approval/status`.

### 2. Install ntfy on your iPhone

1. App Store → **ntfy** (by Philipp C. Heckel)
2. Open ntfy → **+** → **Subscribe to topic**
3. Topic name: run `curl http://127.0.0.1:8787/api/approval/status` and copy `ntfyTopic`
   - Example: `cutline-thermal-a1b2c3d4e5f6`
4. Allow notifications

### 3. Bookmark the approve page

On your iPhone Safari:

**https://cutline-industries.studio/approve**

Tap Share → **Add to Home Screen** → name it "Cutline Approve"

Set your device name (e.g. "Lamont's iPhone") and tap **Save pairing**.

### 4. Enable MCP in Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "phone-approval-lite": {
      "command": "node",
      "args": ["tools/phone-approval-lite/mcp/server.js"],
      "env": {
        "CUTLINE_API_URL": "http://127.0.0.1:8787"
      }
    }
  }
}
```

Start the API: `npm run api` (or `npm run start`).

## Test

```bash
curl -X POST http://127.0.0.1:8787/api/approval/request \
  -H 'Content-Type: application/json' \
  -d '{"service":"Test","detail":"Tap Approve on your phone","waitSeconds":0}'
```

You should get an **ntfy banner** on your iPhone. Tap it → Approve or Deny.

## Agent tools

| Tool | Purpose |
|------|---------|
| `approval_lite_status` | Topic, approve URL, config check |
| `request_signin_approval_lite` | Notify + wait for decision |
| `resolve_signin_approval_lite` | Force approve/deny |
| `approval_lite_setup_doc` | This guide |

We do **not** use Apple Developer for Cutline. This is the only supported approval path.

## vs Apple APNs (not used)

| | **Cutline lite (default)** | Apple APNs (archived) |
|---|---------------------------|------------------------|
| Cost | Free | $99/yr |
| Native iOS app | No (ntfy + Safari) | Yes |
| Lock screen push | Yes (via ntfy) | Yes (via APNs) |
| Serial number | Not used | Not used |
| Mac required | No | Yes |
