# Apple Developer setup — Phone Approval MCP

This gives the agent a real iPhone banner (APNs), like a passkey prompt, when a sign-in needs you.

## 1) Apple Developer account

1. Open https://developer.apple.com/account
2. Sign in with the Apple ID that owns Cutline (paid Apple Developer Program).
3. Note your **Team ID** (top-right Membership details).

## 2) App ID with Push Notifications

1. Certificates, Identifiers & Profiles → **Identifiers** → **+**
2. App IDs → App
3. Description: `ApprovalPing`
4. Bundle ID (Explicit): `studio.cutlineindustries.approvalping`
5. Capabilities: enable **Push Notifications**
6. Register

## 3) APNs Auth Key (.p8)

1. Keys → **+**
2. Name: `Cutline Agent APNs`
3. Enable **Apple Push Notifications service (APNs)**
4. Continue → Register → **Download** the `.p8` (one-time)
5. Copy **Key ID**

You need these three values:

- Team ID
- Key ID
- AuthKey_XXXXXXXXXX.p8 file contents

## 4) Put secrets on the agent

In chat (or files under `tools/phone-approval-apple/secrets/`):

```text
secrets/apple-team-id.txt     → TEAM_ID
secrets/apple-key-id.txt      → KEY_ID
secrets/AuthKey.p8            → full .p8 PEM
secrets/apple-bundle-id.txt   → studio.cutlineindustries.approvalping
secrets/apns-production.txt   → 0   (use 1 only for TestFlight/App Store builds)
```

## 5) Build the iPhone app (Mac + Xcode)

### Mac prerequisites — Command Line Tools

Install Apple's CLI tools on your **Mac** (required before Xcode builds). This agent VM is Linux and cannot run `.dmg` installers.

**Beta (Aug 2026):** [Command Line Tools 27 beta 4](https://download.developer.apple.com/Developer_Tools/Command_Line_Tools_27_beta_4/Command_Line_Tools_27_beta_4.dmg)

1. Sign in at https://developer.apple.com with your Apple Developer account
2. Open the DMG link above (redirects to login if needed)
3. Mount the DMG → run **Install Command Line Tools**
4. Verify on Mac:

```bash
xcode-select -p
clang --version
```

Stable alternative: `xcode-select --install` (macOS Software Update prompt).

### Xcode project

1. On a Mac, open Xcode → New iOS App
2. Product Name: `ApprovalPing`
3. Bundle ID: `studio.cutlineindustries.approvalping`
4. Team: your Apple Developer team
5. Replace source with files in `ios/ApprovalPing/ApprovalPing/`
6. Signing & Capabilities → **+ Push Notifications**
7. Run on your physical iPhone (Developer Mode on)
8. Allow notifications when prompted
9. Copy the device token shown (also auto-copied)
10. Paste token in Cursor chat, or:

```bash
cd tools/phone-approval-apple
node -e "import { saveDeviceToken } from './server/apns.js'; saveDeviceToken(process.argv[1])" '<TOKEN>'
```

## 6) Enable MCP in Cursor

`~/.cursor/mcp.json` includes:

```json
"phone-approval-apple": {
  "command": "node",
  "args": ["tools/phone-approval-apple/mcp/server.js"],
  "env": {
    "APPLE_TEAM_ID": "",
    "APPLE_KEY_ID": "",
    "APPLE_BUNDLE_ID": "studio.cutlineindustries.approvalping",
    "APNS_PRODUCTION": "0"
  }
}
```

Prefer file-based secrets in `secrets/` (already supported). Enable the server in **Cursor Settings → MCP**.

## 7) Test

```bash
cd tools/phone-approval-apple
npm install
npm run send-test
```

You should get a lock-screen / banner alert on the iPhone.

## Agent tools

- `apple_apns_status` — config readiness
- `register_iphone_device_token` — save device token
- `notify_iphone` — fire a banner
- `request_signin_approval` — banner + wait for Approve/Deny
- `resolve_signin_approval` — mark approved/denied

## Security

- Never commit `.p8`, Team/Key IDs, or device tokens
- Rotate APNs key if exposed
- Keep `apns-production=0` until App Store / TestFlight builds
