#!/usr/bin/env node
/**
 * Phone Approval MCP (Apple APNs)
 * Tools the agent calls when a human must approve a sign-in on iPhone.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadConfig, sendPush, assertApnsReady, saveDeviceToken } from '../server/apns.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PENDING_DIR = path.join(ROOT, 'secrets', 'pending');
fs.mkdirSync(PENDING_DIR, { recursive: true, mode: 0o700 });

function pendingPath(id) {
  return path.join(PENDING_DIR, `${id}.json`);
}

function writePending(rec) {
  fs.writeFileSync(pendingPath(rec.id), JSON.stringify(rec, null, 2), { mode: 0o600 });
}

function readPending(id) {
  const p = pendingPath(id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const server = new McpServer({
  name: 'phone-approval-apple',
  version: '1.0.0',
});

server.tool(
  'apple_apns_status',
  'Check whether Apple Developer APNs credentials and iPhone device token are configured.',
  {},
  async () => {
    const cfg = loadConfig();
    const ready = (() => {
      try {
        assertApnsReady(cfg);
        return true;
      } catch {
        return false;
      }
    })();
    const status = {
      ready,
      hasKeyId: Boolean(cfg.keyId),
      hasTeamId: Boolean(cfg.teamId),
      hasP8: cfg.p8.includes('BEGIN PRIVATE KEY'),
      hasDeviceToken: Boolean(cfg.deviceToken),
      bundleId: cfg.bundleId,
      production: cfg.production,
      setupDoc: path.join(ROOT, 'docs', 'APPLE-DEVELOPER-SETUP.md'),
    };
    return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
  },
);

server.tool(
  'register_iphone_device_token',
  'Save the APNs device token printed by the ApprovalPing iOS app after first launch.',
  { deviceToken: z.string().min(16).describe('Hex device token from the iOS app') },
  async ({ deviceToken }) => {
    const saved = saveDeviceToken(deviceToken);
    return {
      content: [{ type: 'text', text: JSON.stringify({ ok: true, deviceTokenPrefix: saved.slice(0, 8) + '…' }, null, 2) }],
    };
  },
);

server.tool(
  'notify_iphone',
  'Send an immediate Apple Push notification to the paired iPhone (alert banner / lock screen).',
  {
    title: z.string().default('Cutline Agent'),
    body: z.string(),
    url: z.string().url().optional().describe('Optional deep link / desktop URL to open'),
  },
  async ({ title, body, url }) => {
    const result = await sendPush({
      title,
      body,
      data: { type: 'notify', url: url || null },
    });
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, ...result }, null, 2) }] };
  },
);

server.tool(
  'request_signin_approval',
  'Push a time-sensitive approval request to iPhone (passkey-style banner). Optionally wait until the phone taps Approve/Deny in the app.',
  {
    service: z.string().describe('What needs approval, e.g. Squarespace, AWS, GitHub'),
    detail: z.string().optional(),
    desktopUrl: z
      .string()
      .url()
      .optional()
      .describe('Cursor agent desktop or sign-in URL to open'),
    waitSeconds: z
      .number()
      .int()
      .min(0)
      .max(900)
      .default(180)
      .describe('Seconds to wait for Approve/Deny from the iPhone app (0 = fire-and-forget)'),
  },
  async ({ service, detail, desktopUrl, waitSeconds }) => {
    const id = randomUUID();
    const rec = {
      id,
      service,
      detail: detail || '',
      desktopUrl: desktopUrl || null,
      status: 'pending',
      createdAt: new Date().toISOString(),
      decidedAt: null,
    };
    writePending(rec);

    const title = `Approve sign-in: ${service}`;
    const body = detail || `Agent needs you to approve ${service}. Open ApprovalPing → Approve.`;
    const push = await sendPush({
      title,
      body,
      data: {
        type: 'approval',
        approvalId: id,
        service,
        desktopUrl: desktopUrl || null,
      },
    });

    if (!waitSeconds) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ ok: true, approvalId: id, status: 'pending', push }, null, 2),
          },
        ],
      };
    }

    const deadline = Date.now() + waitSeconds * 1000;
    while (Date.now() < deadline) {
      const cur = readPending(id);
      if (cur && cur.status !== 'pending') {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ ok: true, approvalId: id, status: cur.status, decidedAt: cur.decidedAt, push }, null, 2),
            },
          ],
        };
      }
      await new Promise((r) => setTimeout(r, 1500));
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ ok: false, approvalId: id, status: 'timeout', push }, null, 2),
        },
      ],
    };
  },
);

server.tool(
  'resolve_signin_approval',
  'Mark an approval request approved/denied (normally called by the iOS app callback; agent can also force-resolve).',
  {
    approvalId: z.string().uuid(),
    decision: z.enum(['approved', 'denied']),
  },
  async ({ approvalId, decision }) => {
    const cur = readPending(approvalId);
    if (!cur) {
      return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'unknown approvalId' }) }], isError: true };
    }
    cur.status = decision;
    cur.decidedAt = new Date().toISOString();
    writePending(cur);
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, ...cur }, null, 2) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
