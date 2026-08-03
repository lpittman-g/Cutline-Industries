# Thermal Automation MCP

Use this connection pack for the **Cutline Industries — Thermal Autopilot**
Cursor Automation. It gives the agent current OpenAI and Discord documentation
without granting access to production systems.

## Create the automation

Cursor Automations cannot be created from the cloud agent API. Create or rename
the private automation in the Cursor dashboard:

1. Connect only `lpittman-g/Cutline-Industries` in
   [Cursor Integrations](https://cursor.com/dashboard/integrations).
2. Confirm the GitHub label `thermal-autopilot` exists (exact spelling; already
   created on this repo).
3. Open [New Automation](https://cursor.com/automations/new), or rename the
   existing private automation
   [`cutline industries`](https://cursor.com/automations/26c7e362-8eff-11f1-a7d1-d6b4613131ce).
   Cursor cannot create or rename automations via MCP — dashboard only.
4. Name it **Cutline Industries — Thermal Autopilot**.
5. Use a GitHub pull-request label trigger for the exact label
   `thermal-autopilot`, **added only** (not on PR opened / closed / every
   label event).
6. Select **Grok 4.5**, **High**, **Fast**, make it private, and disable memory.
7. Add the safe MCP connections below in **Dashboard → Integrations & MCP**.

Use this automation prompt:

```text
Maintain the existing Cutline Industries Thermal implementation.

Inspect the repository before editing. Extend the existing modules under
server/; do not create duplicate lib/awsStorage.ts or lib/autopilot.ts modules.
Use the existing S3, heat pipeline, Stripe, Discord, PostgreSQL, OpenAI, and
Google Workspace services. Never print, commit, or expose credentials. Run the
repository verification suite and create a draft PR. Never merge automatically.
```

Draft PRs from `cursor/cutline-thermal-autopilot-*` (or labeled
`thermal-autopilot`) are excluded from
[`.github/workflows/auto-approve-cursor-prs.yml`](../.github/workflows/auto-approve-cursor-prs.yml)
so this automation cannot undraft/squash-merge its own changes.

## Safe MCP connection pack

The copyable config is
[`../.cursor/mcp.automation.example.json`](../.cursor/mcp.automation.example.json):

| MCP | URL | Access |
|-----|-----|--------|
| OpenAI developer docs | `https://developers.openai.com/mcp?source=cursor` | Documentation only |
| Discord developer docs | `https://docs.discord.com/mcp` | Documentation only |

These MCPs cannot spend OpenAI credits or post to Discord.

## Built-in GitHub connection

Use Cursor's native GitHub integration for repository access, branches, checks,
and draft PRs. Do not add GitHub MCP to this general automation. Restrict the
Cursor GitHub App installation to `lpittman-g/Cutline-Industries`.

## Runtime secrets, not MCP

Thermal already accesses these providers through application SDKs. Store their
test or staging values in the Cloud Agent environment **Secrets** section:

```text
DATABASE_URL
OPENAI_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
DISCORD_HEAT_WEBHOOK_URL
AWS_REGION
AWS_S3_BUCKET_NAME
```

Prefer `CURSOR_AWS_ASSUME_IAM_ROLE_ARN` and an AWS least-privilege role instead
of `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. Google application OAuth
continues to use `client_secret.json` and `token.json`; see
[`GOOGLE-OAUTH.md`](./GOOGLE-OAUTH.md).

Do not attach production secrets to an automation that processes PR comments,
reviews, issue text, or other untrusted input.

## Optional sensitive MCP connections

Add these only to separate, narrowly scoped automations:

| Provider | Remote MCP URL | Safe starting scope |
|----------|----------------|---------------------|
| AWS | `https://aws-mcp.us-east-1.api.aws/mcp?oauth=initialize` | Staging/read-only IAM role |
| Stripe | `https://mcp.stripe.com` | Sandbox account |
| Gmail | `https://gmailmcp.googleapis.com/mcp/v1` | `gmail.readonly` |
| Neon | `https://mcp.neon.tech/mcp?readonly=true&projectId=<PROJECT_ID>` | One project, read-only |
| Supabase | `https://mcp.supabase.com/mcp?project_ref=<REF>&read_only=true` | One project, read-only |

Google MCP OAuth callback:

```text
https://www.cursor.com/agents/mcp/oauth/callback
```

Stripe and Gmail write access can create charges or send messages. AWS write
access can modify infrastructure. Keep those capabilities out of the
label-triggered maintenance automation.

## Local-only MCP

`phone-approval-lite` and `voice-print` remain local Cursor tools. They require
the Cutline API or printer on the same network and should not be attached to a
cloud Automation.
