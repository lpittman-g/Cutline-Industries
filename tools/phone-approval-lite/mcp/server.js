#!/usr/bin/env node
/**
 * Cutline Device Approval MCP (no Apple Developer required)
 * Uses ntfy.sh push + web approve page instead of APNs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API = process.env.CUTLINE_API_URL || 'http://127.0.0.1:8787';

async function api(pathname, opts = {}) {
  const res = await fetch(`${API}${pathname}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) throw new Error(json.error || text || res.statusText);
  return json;
}

const server = new McpServer({
  name: 'phone-approval-lite',
  version: '1.0.0',
});

server.tool(
  'approval_lite_status',
  'Check Cutline device approval (ntfy + web) — works without Apple Developer or serial numbers.',
  {},
  async () => {
    const status = await api('/api/approval/status');
    return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
  },
);

server.tool(
  'request_signin_approval_lite',
  'Send iPhone notification via ntfy and wait for Approve/Deny on /approve page. No Apple Developer needed.',
  {
    service: z.string().describe('e.g. Squarespace, AWS, GitHub'),
    detail: z.string().optional(),
    desktopUrl: z.string().url().optional(),
    waitSeconds: z.number().int().min(0).max(900).default(180),
  },
  async ({ service, detail, desktopUrl, waitSeconds }) => {
    const result = await api('/api/approval/request', {
      method: 'POST',
      body: JSON.stringify({ service, detail, desktopUrl, waitSeconds }),
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  'resolve_signin_approval_lite',
  'Force-resolve an approval (approved/denied).',
  {
    approvalId: z.string().uuid(),
    decision: z.enum(['approved', 'denied']),
  },
  async ({ approvalId, decision }) => {
    const result = await api(`/api/approval/${approvalId}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

const setupDoc = path.join(__dirname, '..', 'docs', 'SETUP-NO-APPLE-DEV.md');
server.tool(
  'approval_lite_setup_doc',
  'Return path to setup guide for ntfy + web approval (no Apple Developer).',
  {},
  async () => ({
    content: [{ type: 'text', text: fs.existsSync(setupDoc) ? fs.readFileSync(setupDoc, 'utf8') : setupDoc }],
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
