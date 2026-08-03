# Agent tools

Standalone tools that extend Cursor Cloud Agents for Cutline operations.

## phone-approval-lite (no Apple Developer)

iPhone approvals via **ntfy** push + `/approve` web page. No serial numbers, no $99/yr Apple program.

```bash
cd tools/phone-approval-lite && npm install
# See docs/SETUP-NO-APPLE-DEV.md
```

MCP: `tools/phone-approval-lite/mcp/server.js`

## phone-approval-apple

iPhone push notifications when the agent needs sign-in approval (Squarespace 2FA, Apple Developer, etc.).

```bash
cd tools/phone-approval-apple
npm install
# Add secrets/ — see docs/APPLE-DEVELOPER-SETUP.md
npm run send-test
```

MCP server: `tools/phone-approval-apple/mcp/server.js`

## email-to-cursor

Forward email to `cursor@cutline-industries.studio` → triggers a Cursor Cloud Agent run.

Setup: [`email-to-cursor/docs/SETUP.md`](email-to-cursor/docs/SETUP.md)

## MCP configuration (Cursor)

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "phone-approval-apple": {
      "command": "node",
      "args": ["tools/phone-approval-apple/mcp/server.js"],
      "env": {
        "APPLE_BUNDLE_ID": "studio.cutlineindustries.approvalping",
        "APNS_PRODUCTION": "0"
      }
    }
  }
}
```

Use absolute paths in Cloud Agent environments (e.g. `/agent/spawn-channel/tools/phone-approval-apple/mcp/server.js`).
