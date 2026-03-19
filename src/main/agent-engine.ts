import { watch, type FSWatcher } from 'chokidar'
import { relative } from 'path'
import { AgentStore, type AgentDefinition } from './agent-store'
import { AgentRunner } from './agent-runner'
import type { VaultReader } from './vault-reader'
import type { McpBridge } from './mcp-bridge'

const MAX_CONCURRENT = 2

interface SchedulePreset {
  label: string
  checkIntervalMs: number
  expectedIntervalMs: number
  shouldRunNow: () => boolean
  shouldHaveRunSince: (lastRunAt: number) => boolean
}

const SCHEDULE_PRESETS: Record<string, SchedulePreset> = {
  every_morning: {
    label: 'Every morning',
    checkIntervalMs: 60_000,
    expectedIntervalMs: 24 * 60 * 60_000,
    shouldRunNow: () => {
      const h = new Date().getHours()
      const m = new Date().getMinutes()
      return h === 8 && m === 0
    },
    shouldHaveRunSince(lastRunAt: number): boolean {
      const now = new Date()
      const today8am = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0)
      return lastRunAt < today8am.getTime() && now.getTime() > today8am.getTime()
    }
  },
  every_hour: {
    label: 'Every hour',
    checkIntervalMs: 60_000,
    expectedIntervalMs: 60 * 60_000,
    shouldRunNow: () => new Date().getMinutes() === 0,
    shouldHaveRunSince(lastRunAt: number): boolean {
      return Date.now() - lastRunAt > 65 * 60_000
    }
  },
  end_of_day: {
    label: 'End of day',
    checkIntervalMs: 60_000,
    expectedIntervalMs: 24 * 60 * 60_000,
    shouldRunNow: () => {
      const h = new Date().getHours()
      const m = new Date().getMinutes()
      return h === 18 && m === 0
    },
    shouldHaveRunSince(lastRunAt: number): boolean {
      const now = new Date()
      const today6pm = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0)
      return lastRunAt < today6pm.getTime() && now.getTime() > today6pm.getTime()
    }
  },
  every_15_minutes: {
    label: 'Every 15 minutes',
    checkIntervalMs: 60_000,
    expectedIntervalMs: 15 * 60_000,
    shouldRunNow: () => new Date().getMinutes() % 15 === 0,
    shouldHaveRunSince(lastRunAt: number): boolean {
      return Date.now() - lastRunAt > 20 * 60_000
    }
  }
}

type AgentStatus = 'idle' | 'running' | 'queued' | 'error'

export class AgentEngine {
  private store: AgentStore
  private runner: AgentRunner | null = null
  private vaultReader: VaultReader
  private mcpBridge: McpBridge | null
  private vaultPath: string

  private scheduleInterval: ReturnType<typeof setInterval> | null = null
  private fileWatcher: FSWatcher | null = null
  private runningCount = 0
  private statusMap = new Map<string, AgentStatus>()
  private queue: { agent: AgentDefinition; trigger: 'schedule' | 'file_change' }[] = []
  private lastScheduledRun = new Map<string, number>()
  private fileChangeDebounce = new Map<string, ReturnType<typeof setTimeout>>()
  private apiKey: string | null = null

  constructor(
    configDir: string,
    vaultReader: VaultReader,
    mcpBridge: McpBridge | null,
    vaultPath: string
  ) {
    this.store = new AgentStore(configDir)
    this.vaultReader = vaultReader
    this.mcpBridge = mcpBridge
    this.vaultPath = vaultPath
  }

  setApiKey(key: string) {
    this.apiKey = key
    this.runner = new AgentRunner(key, this.vaultReader, this.mcpBridge)
  }

  getStore(): AgentStore {
    return this.store
  }

  getStatus(agentId: string): AgentStatus {
    return this.statusMap.get(agentId) || 'idle'
  }

  async start() {
    if (this.scheduleInterval) return

    this.scheduleInterval = setInterval(() => this.checkSchedules(), 60_000)

    await this.setupFileWatcher()
    await this.catchUpMissedRuns()
  }

  stop() {
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval)
      this.scheduleInterval = null
    }
    if (this.fileWatcher) {
      this.fileWatcher.close()
      this.fileWatcher = null
    }
    for (const timeout of this.fileChangeDebounce.values()) {
      clearTimeout(timeout)
    }
    this.fileChangeDebounce.clear()
  }

  async startAgent(agentId: string, trigger: 'manual' | 'schedule' | 'file_change'): Promise<string | null> {
    if (!this.runner || !this.apiKey) return null

    const agent = await this.store.get(agentId)
    if (!agent) return null

    if (this.runningCount >= MAX_CONCURRENT && trigger !== 'manual') {
      this.queue.push({ agent, trigger: trigger as 'schedule' | 'file_change' })
      this.statusMap.set(agentId, 'queued')
      return null
    }

    this.runningCount++
    this.statusMap.set(agentId, 'running')

    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    this.executeInBackground(agent, trigger, runId)

    return runId
  }

  private async executeInBackground(agent: AgentDefinition, trigger: 'manual' | 'schedule' | 'file_change', runId: string) {
    try {
      const run = await this.runner!.run(agent, trigger, runId)
      await this.store.saveRun(run)
      this.statusMap.set(agent.id, run.status === 'error' ? 'error' : 'idle')
    } catch {
      this.statusMap.set(agent.id, 'error')
    } finally {
      this.runningCount--
      this.processQueue()
    }
  }

  cancelAgent(runId: string) {
    this.runner?.cancel(runId)
  }

  private async processQueue() {
    if (this.queue.length === 0 || this.runningCount >= MAX_CONCURRENT) return

    const next = this.queue.shift()
    if (next) {
      this.startAgent(next.agent.id, next.trigger)
    }
  }

  private async catchUpMissedRuns() {
    if (!this.runner || !this.apiKey) return

    const agents = await this.store.list()

    for (const summary of agents) {
      if (!summary.enabled) continue
      if (summary.trigger.type !== 'schedule' || !summary.trigger.schedule) continue

      const preset = SCHEDULE_PRESETS[summary.trigger.schedule]
      if (!preset) continue

      const lastRunAt = summary.lastRunAt || 0
      if (lastRunAt === 0) continue

      if (preset.shouldHaveRunSince(lastRunAt)) {
        console.log(`[AgentEngine] Catch-up: "${summary.name}" missed its schedule (last ran ${new Date(lastRunAt).toLocaleString()})`)
        this.startAgent(summary.id, 'schedule')
      }
    }
  }

  private async checkSchedules() {
    const agents = await this.store.list()
    const now = Date.now()

    for (const summary of agents) {
      if (!summary.enabled) continue
      if (summary.trigger.type !== 'schedule' || !summary.trigger.schedule) continue

      const preset = SCHEDULE_PRESETS[summary.trigger.schedule]
      if (!preset) continue
      if (!preset.shouldRunNow()) continue

      const lastRun = this.lastScheduledRun.get(summary.id) || 0
      if (now - lastRun < 90_000) continue

      this.lastScheduledRun.set(summary.id, now)
      this.startAgent(summary.id, 'schedule')
    }
  }

  private async setupFileWatcher() {
    if (this.fileWatcher) return

    this.fileWatcher = watch(this.vaultPath, {
      ignored: /(^|[/\\])(\.|node_modules|\.git|\.obsidian|core|\.scripts)/,
      persistent: true,
      ignoreInitial: true,
      depth: 4
    })

    this.fileWatcher.on('all', async (_eventType, filePath) => {
      const relPath = relative(this.vaultPath, filePath)
      const agents = await this.store.list()

      for (const summary of agents) {
        if (!summary.enabled) continue
        if (summary.trigger.type !== 'file_change' || !summary.trigger.watchPaths?.length) continue

        const matches = summary.trigger.watchPaths.some(wp =>
          relPath.startsWith(wp) || relPath === wp
        )
        if (!matches) continue

        // Debounce: 5 seconds per agent
        const key = summary.id
        const existing = this.fileChangeDebounce.get(key)
        if (existing) clearTimeout(existing)

        this.fileChangeDebounce.set(key, setTimeout(() => {
          this.fileChangeDebounce.delete(key)
          this.startAgent(summary.id, 'file_change')
        }, 5000))
      }
    })
  }
}
