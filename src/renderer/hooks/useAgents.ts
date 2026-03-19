import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  AgentListItem,
  AgentDefinition,
  AgentRun,
  AgentTemplate,
  ToolStep
} from '../../preload/index'

interface LiveRunData {
  runId: string
  startedAt: number
  steps: ToolStep[]
  output: string
}

export function useAgents() {
  const [agents, setAgents] = useState<AgentListItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition | null>(null)
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [templates, setTemplates] = useState<AgentTemplate[]>([])
  const [loading, setLoading] = useState(true)

  // Background accumulator for ALL live runs — persists across agent selection changes
  const liveRunsRef = useRef(new Map<string, LiveRunData>())
  // Tick counter to trigger re-renders when live data for the selected agent changes
  const [liveTick, setLiveTick] = useState(0)
  const selectedIdRef = useRef<string | null>(null)

  selectedIdRef.current = selectedId

  const bumpLiveIfSelected = (agentId: string) => {
    if (agentId === selectedIdRef.current) {
      setLiveTick(t => t + 1)
    }
  }

  const refresh = useCallback(async () => {
    const list = await window.dex.agents.list()
    setAgents(list)
  }, [])

  useEffect(() => {
    Promise.all([
      window.dex.agents.list(),
      window.dex.agents.getTemplates()
    ]).then(([list, tpls]) => {
      setAgents(list)
      setTemplates(tpls)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const unsub1 = window.dex.agents.onStatusChange((data) => {
      setAgents(prev => prev.map(a =>
        a.id === data.agentId
          ? { ...a, status: data.status as AgentListItem['status'] }
          : a
      ))

      if (data.status === 'running') {
        liveRunsRef.current.set(data.agentId, {
          runId: data.runId,
          startedAt: Date.now(),
          steps: [],
          output: ''
        })
        bumpLiveIfSelected(data.agentId)
      }

      if (data.status === 'completed' || data.status === 'error' || data.status === 'cancelled') {
        liveRunsRef.current.delete(data.agentId)
        bumpLiveIfSelected(data.agentId)

        if (data.agentId === selectedIdRef.current) {
          window.dex.agents.getRuns(data.agentId).then(setRuns)
        }
        refresh()
      }
    })

    const unsub2 = window.dex.agents.onStepUpdate((data) => {
      const live = liveRunsRef.current.get(data.agentId)
      if (!live) return

      if (data.step.status === 'running') {
        live.steps = [...live.steps, data.step]
      } else {
        const idx = live.steps.findIndex(s => s.tool === data.step.tool && s.status === 'running')
        if (idx >= 0) {
          live.steps = [...live.steps]
          live.steps[idx] = data.step
        } else {
          live.steps = [...live.steps, data.step]
        }
      }
      bumpLiveIfSelected(data.agentId)
    })

    const unsub3 = window.dex.agents.onRunOutput((data) => {
      const live = liveRunsRef.current.get(data.agentId)
      if (!live) return
      live.output += data.delta
      bumpLiveIfSelected(data.agentId)
    })

    return () => { unsub1(); unsub2(); unsub3() }
  }, [refresh])

  // Derive live state for the currently selected agent
  const liveData = selectedId ? liveRunsRef.current.get(selectedId) : undefined
  // Reference liveTick so React knows this derivation depends on it
  void liveTick
  const liveRunId = liveData?.runId ?? null
  const liveSteps = liveData?.steps ?? []
  const liveOutput = liveData?.output ?? ''
  const liveStartedAt = liveData?.startedAt ?? 0

  const selectAgent = useCallback(async (id: string | null) => {
    setSelectedId(id)

    if (!id) {
      setSelectedAgent(null)
      setRuns([])
      return
    }
    const [agent, agentRuns] = await Promise.all([
      window.dex.agents.get(id),
      window.dex.agents.getRuns(id)
    ])
    setSelectedAgent(agent)
    setRuns(agentRuns)
    // Force a render to pick up any existing live data for this agent
    setLiveTick(t => t + 1)
  }, [])

  const createAgent = useCallback(async (agent: AgentDefinition) => {
    await window.dex.agents.save(agent)
    await refresh()
    setSelectedId(agent.id)
    setSelectedAgent(agent)
  }, [refresh])

  const updateAgent = useCallback(async (agent: AgentDefinition) => {
    await window.dex.agents.save(agent)
    await refresh()
    setSelectedAgent(agent)
  }, [refresh])

  const deleteAgent = useCallback(async (id: string) => {
    await window.dex.agents.delete(id)
    if (selectedId === id) {
      setSelectedId(null)
      setSelectedAgent(null)
      setRuns([])
    }
    await refresh()
  }, [selectedId, refresh])

  const runAgent = useCallback(async (id: string) => {
    // Pre-seed live data so the UI shows immediately
    const result = await window.dex.agents.run(id)
    if (result) {
      liveRunsRef.current.set(id, {
        runId: result.id,
        startedAt: Date.now(),
        steps: [],
        output: ''
      })
      setLiveTick(t => t + 1)
    }
    await refresh()
  }, [refresh])

  const cancelAgent = useCallback(async (runId: string) => {
    await window.dex.agents.cancel(runId)
  }, [])

  const toggleEnabled = useCallback(async (agent: AgentDefinition) => {
    const updated = { ...agent, enabled: !agent.enabled, updatedAt: Date.now() }
    await window.dex.agents.save(updated)
    setSelectedAgent(updated)
    await refresh()
  }, [refresh])

  return {
    agents,
    selectedId,
    selectedAgent,
    runs,
    templates,
    liveSteps,
    liveOutput,
    liveRunId,
    liveStartedAt,
    loading,
    selectAgent,
    createAgent,
    updateAgent,
    deleteAgent,
    runAgent,
    cancelAgent,
    toggleEnabled,
    refresh
  }
}
