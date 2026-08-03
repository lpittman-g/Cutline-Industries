#!/usr/bin/env node
/**
 * Cutline Voice Print MCP — say "print" in Cursor chat to send blueprints to HP OfficeJet.
 * Must run locally on the same Wi‑Fi as the printer (192.168.1.157).
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { listCatalog, printFile } from '../print.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../..')

dotenv.config({ path: path.join(REPO_ROOT, '.env') })
dotenv.config({ path: path.join(__dirname, '../.env') })

const DEFAULT_FILE =
  process.env.VOICE_PRINT_DEFAULT_FILE || 'docs/combined-print.html'

const server = new McpServer({
  name: 'voice-print',
  version: '1.0.0',
})

server.tool(
  'list_printables',
  'List Cutline blueprints and docs that can be sent to the HP OfficeJet printer.',
  {},
  async () => {
    const items = await listCatalog()
    const lines = items.map((i) => `${i.id}\t${i.label}\t${i.path}`)
    return {
      content: [
        {
          type: 'text',
          text: `Default when user says "print": ${DEFAULT_FILE}\n\n${lines.join('\n')}`,
        },
      ],
    }
  },
)

server.tool(
  'print',
  'Send a Cutline blueprint or doc to the HP OfficeJet. Call this when the user says "print" in chat.',
  {
    file: z
      .string()
      .optional()
      .describe(
        `Repo-relative path or catalog id. Defaults to ${DEFAULT_FILE} when omitted.`,
      ),
  },
  async ({ file }) => {
    const items = await listCatalog()
    const target = file || DEFAULT_FILE
    const match = items.find((i) => i.id === target || i.path === target)
    const resolved = match?.path ?? target
    const result = await printFile(resolved)
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              ok: true,
              message: `Sent to HP OfficeJet at ${result.printer}`,
              file: result.file,
            },
            null,
            2,
          ),
        },
      ],
    }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
