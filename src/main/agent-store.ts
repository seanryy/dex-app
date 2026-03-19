import { readFile, writeFile, mkdir, readdir, unlink } from 'fs/promises'
import { join } from 'path'

export interface AgentTrigger {
  type: 'manual' | 'schedule' | 'file_change'
  schedule?: string
  watchPaths?: string[]
}

export interface AgentDefinition {
  id: string
  name: string
  description: string
  icon: string
  systemPrompt: string
  trigger: AgentTrigger
  maxRounds: number
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface AgentRun {
  id: string
  agentId: string
  startedAt: number
  finishedAt?: number
  status: 'running' | 'completed' | 'error' | 'cancelled'
  steps: { tool: string; server: string; args: Record<string, unknown>; result: string; durationMs: number; status: string }[]
  output: string
  trigger: 'manual' | 'schedule' | 'file_change'
}

export interface AgentSummary {
  id: string
  name: string
  description: string
  icon: string
  trigger: AgentTrigger
  enabled: boolean
  lastRunAt?: number
  lastRunStatus?: string
}

export class AgentStore {
  private agentsDir: string
  private runsDir: string

  constructor(configDir: string) {
    this.agentsDir = join(configDir, 'agents')
    this.runsDir = join(configDir, 'agent-runs')
  }

  private async ensureDirs() {
    await mkdir(this.agentsDir, { recursive: true })
    await mkdir(this.runsDir, { recursive: true })
  }

  async list(): Promise<AgentSummary[]> {
    await this.ensureDirs()
    try {
      const files = await readdir(this.agentsDir)
      const summaries: AgentSummary[] = []

      for (const file of files) {
        if (!file.endsWith('.json')) continue
        try {
          const raw = await readFile(join(this.agentsDir, file), 'utf-8')
          const agent = JSON.parse(raw) as AgentDefinition
          const lastRun = await this.getLastRun(agent.id)
          summaries.push({
            id: agent.id,
            name: agent.name,
            description: agent.description,
            icon: agent.icon,
            trigger: agent.trigger,
            enabled: agent.enabled,
            lastRunAt: lastRun?.startedAt,
            lastRunStatus: lastRun?.status
          })
        } catch { /* skip corrupt files */ }
      }

      return summaries.sort((a, b) => a.name.localeCompare(b.name))
    } catch {
      return []
    }
  }

  async get(id: string): Promise<AgentDefinition | null> {
    try {
      const raw = await readFile(join(this.agentsDir, `${id}.json`), 'utf-8')
      return JSON.parse(raw) as AgentDefinition
    } catch {
      return null
    }
  }

  async save(agent: AgentDefinition): Promise<void> {
    await this.ensureDirs()
    await writeFile(
      join(this.agentsDir, `${agent.id}.json`),
      JSON.stringify(agent, null, 2),
      'utf-8'
    )
  }

  async delete(id: string): Promise<void> {
    try {
      await unlink(join(this.agentsDir, `${id}.json`))
    } catch { /* ignore */ }
  }

  async listRuns(agentId: string, limit = 10): Promise<AgentRun[]> {
    await this.ensureDirs()
    try {
      const files = await readdir(this.runsDir)
      const runs: AgentRun[] = []

      for (const file of files) {
        if (!file.startsWith(agentId) || !file.endsWith('.json')) continue
        try {
          const raw = await readFile(join(this.runsDir, file), 'utf-8')
          runs.push(JSON.parse(raw) as AgentRun)
        } catch { /* skip */ }
      }

      return runs
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, limit)
    } catch {
      return []
    }
  }

  async saveRun(run: AgentRun): Promise<void> {
    await this.ensureDirs()
    await writeFile(
      join(this.runsDir, `${run.agentId}-${run.id}.json`),
      JSON.stringify(run, null, 2),
      'utf-8'
    )
  }

  private async getLastRun(agentId: string): Promise<AgentRun | null> {
    const runs = await this.listRuns(agentId, 1)
    return runs[0] || null
  }
}
