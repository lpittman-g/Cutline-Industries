# Email → Cursor Agent

Send mail to **`cursor@cutline-industries.studio`** and a Cursor Cloud Agent run starts (or continues) with your message as the prompt.

## Architecture

```
iPhone Mail / Gmail
   → cursor@cutline-industries.studio  (Google Workspace)
   → Gmail Apps Script (on that mailbox)
   → Cursor Automation webhook
   → Cloud Agent (this Cutline / Thermal work)
```

## Part A — Create the mailbox (Google Workspace)

1. Open https://admin.google.com → **Directory → Users → Add user**
2. Create:
   - First name: `Cursor`
   - Last name: `Agent`
   - Primary email: `cursor@cutline-industries.studio`
3. Set a temp password, skip forcing change if possible (or change it once on first login).
4. Optional: add aliases `agent@…`, `approve@…` pointing at the same user.

> If you already have a Workspace seat limit, create an **alias** on your own user instead:
> Users → `lpittman@cutline-industries.studio` → User information → Alternate email / Alias → `cursor@…`

## Part B — Cursor Automation (webhook)

1. Open https://cursor.com/automations → **New automation**
2. Trigger: **Webhook**
3. Name: `Email → Cutline Agent`
4. Repository / environment: Cutline-Industries (or your Thermal env)
5. Prompt (paste exactly):

```
You received an email intended for the Cutline / Thermal Cursor agent.

From: {{from}}
Subject: {{subject}}
Date: {{date}}

Body:
{{body}}

Instructions:
- Treat the email body as the user's latest instruction.
- If subject starts with "RE:" or body contains "bc-...", continue that existing task context.
- Prefer concise execution. Do not ask for confirmation unless blocked on secrets.
- When done, summarize what you did in 3-6 bullets.
```

6. Save → copy **Webhook URL** and **API key**
7. Store them in agent secrets (or paste in chat):

```bash
# phone-approval style secrets dir also fine
echo 'WEBHOOK_URL' > /agent/email-to-cursor/secrets/cursor-webhook-url.txt
echo 'API_KEY'     > /agent/email-to-cursor/secrets/cursor-webhook-key.txt
```

## Part C — Gmail Apps Script on `cursor@…`

1. Sign into Gmail as `cursor@cutline-industries.studio`
2. https://script.google.com → New project → paste `gmail-apps-script/Code.gs`
3. Project Settings → Script properties:
   - `CURSOR_WEBHOOK_URL` = (from Part B)
   - `CURSOR_WEBHOOK_KEY` = (from Part B)
4. Run `installTrigger` once (authorize Gmail + external requests)
5. Send a test email to `cursor@cutline-industries.studio` from your phone

## Part D — Phone Mail

On iPhone Mail / Gmail, add the `cursor@…` account **or** just email that address from your personal inbox. Either works.

## Security

- Only the Apps Script + webhook key can launch agents.
- Do not put the webhook API key in GitHub issues.
- Rotate the automation webhook key if exposed.
