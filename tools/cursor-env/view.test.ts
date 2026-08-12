import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CLOUD_NOTE,
  DASHBOARD_ENVIRONMENTS_URL,
  formatEnvironmentView,
  resolveConfigPath,
} from './view.ts'
import type { EnvironmentView } from './types.ts'

describe('cursor-env view', () => {
  it('resolves config path under .cursor', () => {
    assert.equal(resolveConfigPath('/repo'), '/repo/.cursor/environment.json')
  })

  it('formats a complete environment view', () => {
    const view: EnvironmentView = {
      configPath: '/repo/.cursor/environment.json',
      configExists: true,
      parseError: null,
      config: {
        name: 'Cutline Industries',
        snapshot: 'snapshot-test',
        agentCanUpdateSnapshot: true,
        install:
          'npm install\ntest -f .env || cp .env.example .env\nbash scripts/cloud-postgres.sh ensure',
        start: 'bash scripts/cloud-postgres.sh start',
        terminals: [
          {
            name: 'thermal',
            command: 'npm run db:migrate && npm run start',
            description: 'API + Vite',
          },
        ],
        ports: [
          { name: 'vite', port: 5173 },
          { name: 'api', port: 8787 },
        ],
      },
      dashboardUrl: DASHBOARD_ENVIRONMENTS_URL,
      probes: [
        { id: 'dotenv', label: '.env', ok: true, detail: 'present' },
        { id: 'api', label: 'api :8787', ok: false, detail: 'down' },
      ],
      cloudNote: CLOUD_NOTE,
    }

    const text = formatEnvironmentView(view)
    assert.match(text, /Cutline Industries/)
    assert.match(text, /snapshot-test/)
    assert.match(text, /npm install/)
    assert.match(text, /thermal/)
    assert.match(text, /vite 5173/)
    assert.match(text, /✓ \.env/)
    assert.match(text, /Dashboard:/)
    assert.match(text, /no public API for environment Builds/)
  })

  it('formats missing config', () => {
    const text = formatEnvironmentView({
      configPath: '/repo/.cursor/environment.json',
      configExists: false,
      parseError: null,
      config: null,
      dashboardUrl: DASHBOARD_ENVIRONMENTS_URL,
      probes: [],
      cloudNote: CLOUD_NOTE,
    })
    assert.match(text, /missing/)
  })
})
