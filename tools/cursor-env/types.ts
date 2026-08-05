/** Shape of `.cursor/environment.json` (Cursor cloud env schema subset). */
export type EnvironmentJson = {
  name?: string
  snapshot?: string
  agentCanUpdateSnapshot?: boolean
  install?: string
  start?: string
  terminals?: Array<{
    name?: string
    command?: string
    description?: string
  }>
  ports?: Array<{
    name?: string
    port?: number
  }>
  build?: {
    dockerfile?: string
    context?: string
  }
}

export type ProbeResult = {
  id: string
  label: string
  ok: boolean
  detail: string
}

export type EnvironmentView = {
  configPath: string
  configExists: boolean
  config: EnvironmentJson | null
  parseError: string | null
  dashboardUrl: string
  probes: ProbeResult[]
  cloudNote: string
}
