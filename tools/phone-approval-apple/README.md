# Phone Approval (Apple Developer + APNs)

When the agent needs you to approve a sign-in, it sends a real iPhone push notification via Apple Push Notification service.

## Quick path

1. Follow [`docs/APPLE-DEVELOPER-SETUP.md`](docs/APPLE-DEVELOPER-SETUP.md)
2. Build `ios/ApprovalPing` on a Mac, run on your iPhone
3. Paste device token + APNs key materials into `secrets/`
4. Enable MCP `phone-approval-apple` in Cursor Settings
5. Test: `npm run send-test`

## Agent usage

```
request_signin_approval
  service: Squarespace
  detail: Approve 2FA / passkey on agent desktop
  desktopUrl: https://cursor.com/agents/<id>/desktop
  waitSeconds: 180
```
