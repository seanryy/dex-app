import { useState, useRef, useEffect } from 'react'
import {
  Plus, Play, Pause, Trash2, Edit2, Loader2, Clock, FolderSync, Hand,
  Sparkles, ChevronRight, Power, PowerOff
} from 'lucide-react'
import { useAgents } from '../../hooks/useAgents'
import { AgentCreator } from './AgentCreator'
import { AgentRunLog } from './AgentRunLog'
import type { AgentListItem, AgentDefinition } from '../../../preload/index'

const TRIGGER_LABELS: Record<string, { label: string; icon: typeof Clock }> = {
  manual: { label: 'Manual', icon: Hand },
  schedule: { label: 'Scheduled', icon: Clock },
  file_change: { label: 'File watcher', icon: FolderSync }
}

export function AgentsView() {
  const {
    agents, selectedId, selectedAgent, runs, templates,
    liveSteps, liveOutput, liveRunId, liveStartedAt,
    selectAgent, createAgent, updateAgent, deleteAgent, runAgent, cancelAgent, toggleEnabled
  } = useAgents()

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list')
  const liveLogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (liveLogRef.current) {
      liveLogRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [liveSteps.length, liveOutput])

  function handleCreate(agent: AgentDefinition) {
    createAgent(agent)
    setMode('list')
  }

  function handleEdit(agent: AgentDefinition) {
    updateAgent(agent)
    setMode('list')
  }

  function handleDelete(id: string) {
    if (confirm('Delete this agent? Run history will be lost.')) {
      deleteAgent(id)
      setMode('list')
    }
  }

  if (mode === 'create') {
    return (
      <div className="flex h-full">
        <AgentListPanel
          agents={agents}
          selectedId={null}
          onSelect={() => {}}
          onCreate={() => {}}
        />
        <div className="flex-1 border-l border-border overflow-y-auto">
          <AgentCreator
            templates={templates}
            onSave={handleCreate}
            onCancel={() => setMode('list')}
          />
        </div>
      </div>
    )
  }

  if (mode === 'edit' && selectedAgent) {
    return (
      <div className="flex h-full">
        <AgentListPanel
          agents={agents}
          selectedId={selectedId}
          onSelect={() => {}}
          onCreate={() => {}}
        />
        <div className="flex-1 border-l border-border overflow-y-auto">
          <AgentCreator
            templates={templates}
            editingAgent={selectedAgent}
            onSave={handleEdit}
            onCancel={() => setMode('list')}
          />
        </div>
      </div>
    )
  }

  const isRunning = selectedAgent && agents.find(a => a.id === selectedId)?.status === 'running'
  const showLiveLog = isRunning || liveRunId

  return (
    <div className="flex h-full">
      <AgentListPanel
        agents={agents}
        selectedId={selectedId}
        onSelect={(id) => { selectAgent(id); setMode('list') }}
        onCreate={() => setMode('create')}
      />

      <div className="flex-1 border-l border-border overflow-y-auto">
        {selectedAgent ? (
          <div className="p-6 space-y-6">
            {/* Agent header */}
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <AgentIcon icon={selectedAgent.icon} size="lg" running={!!isRunning} />
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">{selectedAgent.name}</h2>
                  <p className="text-sm text-text-secondary mt-0.5">{selectedAgent.description}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <TriggerBadge trigger={selectedAgent.trigger} />
                    <StatusBadge status={agents.find(a => a.id === selectedId)?.status || 'idle'} />
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {isRunning ? (
                <button
                  onClick={() => liveRunId && cancelAgent(liveRunId)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20
                    rounded-lg text-sm font-medium transition-colors"
                >
                  <Pause className="w-4 h-4" />
                  Stop
                </button>
              ) : (
                <button
                  onClick={() => selectedId && runAgent(selectedId)}
                  className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white
                    rounded-lg text-sm font-medium transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Run Now
                </button>
              )}
              <button
                onClick={() => selectedAgent && toggleEnabled(selectedAgent)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${selectedAgent.enabled
                    ? 'bg-surface-2 text-text-secondary hover:bg-surface-3'
                    : 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
                  }`}
              >
                {selectedAgent.enabled ? (
                  <><PowerOff className="w-4 h-4" /> Disable</>
                ) : (
                  <><Power className="w-4 h-4" /> Enable</>
                )}
              </button>
              <button
                onClick={() => setMode('edit')}
                className="flex items-center gap-2 px-4 py-2 bg-surface-2 text-text-secondary hover:bg-surface-3
                  rounded-lg text-sm font-medium transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={() => selectedId && handleDelete(selectedId)}
                className="flex items-center gap-2 px-4 py-2 bg-surface-2 text-text-secondary hover:bg-red-500/10
                  hover:text-red-500 rounded-lg text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Live run log */}
            {showLiveLog && (
              <div ref={liveLogRef}>
                <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                  Live Run
                </h3>
                <div className="border border-accent/20 rounded-xl p-4 bg-accent/[0.02]">
                  <AgentRunLog
                    run={{
                      id: liveRunId || 'pending',
                      agentId: selectedId!,
                      startedAt: liveStartedAt || Date.now(),
                      status: 'running',
                      steps: liveSteps,
                      output: liveOutput,
                      trigger: 'manual'
                    }}
                    liveSteps={liveSteps}
                    liveOutput={liveOutput}
                    isLive
                  />
                </div>
              </div>
            )}

            {/* Run history */}
            <div>
              <h3 className="text-sm font-medium text-text-primary mb-3">
                Run History {runs.length > 0 && <span className="text-text-tertiary font-normal">({runs.length})</span>}
              </h3>
              {runs.length === 0 && !showLiveLog ? (
                <p className="text-sm text-text-tertiary py-4">No runs yet. Click "Run Now" to test this agent.</p>
              ) : runs.length === 0 ? null : (
                <div className="space-y-4">
                  {runs.map(run => (
                    <div key={run.id} className="border border-border rounded-xl p-4">
                      <AgentRunLog run={run} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">Your Agent Team</h3>
            <p className="text-sm text-text-secondary max-w-sm mb-6">
              Create autonomous agents that work in the background — organizing your inbox, following up on meetings, tracking tasks, and more.
            </p>
            <button
              onClick={() => setMode('create')}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white
                rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Your First Agent
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function AgentListPanel({
  agents,
  selectedId,
  onSelect,
  onCreate
}: {
  agents: AgentListItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
}) {
  return (
    <div className="w-72 flex-shrink-0 flex flex-col bg-surface-0">
      <div className="p-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">Agents</h2>
        <button
          onClick={onCreate}
          className="w-7 h-7 rounded-lg bg-accent/10 hover:bg-accent/20 flex items-center justify-center
            text-accent transition-colors"
          title="Create agent"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {agents.length === 0 ? (
          <p className="text-xs text-text-tertiary text-center py-8 px-4">
            No agents yet. Create one to get started.
          </p>
        ) : (
          agents.map(agent => (
            <button
              key={agent.id}
              onClick={() => onSelect(agent.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all
                ${selectedId === agent.id
                  ? 'bg-accent/10 border border-accent/20'
                  : 'hover:bg-surface-1 border border-transparent'
                }`}
            >
              <AgentIcon icon={agent.icon} running={agent.status === 'running'} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary truncate">{agent.name}</span>
                  {!agent.enabled && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-surface-2 text-text-tertiary rounded-full">off</span>
                  )}
                </div>
                <div className="text-[11px] text-text-tertiary truncate">{agent.description}</div>
              </div>
              <StatusDot status={agent.status} />
              <ChevronRight className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function AgentIcon({ icon, size = 'sm', running = false }: { icon: string; size?: 'sm' | 'lg'; running?: boolean }) {
  const sizeClasses = size === 'lg' ? 'w-12 h-12 rounded-xl' : 'w-8 h-8 rounded-lg'
  const textSize = size === 'lg' ? 'text-2xl' : 'text-base'

  return (
    <div className={`${sizeClasses} bg-accent/10 flex items-center justify-center flex-shrink-0 relative`}>
      {running ? (
        <Loader2 className={`${size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'} text-accent animate-spin`} />
      ) : (
        <span className={textSize}>{icon}</span>
      )}
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: 'bg-accent animate-pulse',
    queued: 'bg-amber-400',
    error: 'bg-red-500',
    idle: 'bg-surface-3'
  }
  return <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[status] || colors.idle}`} />
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    running: 'bg-accent/10 text-accent',
    queued: 'bg-amber-500/10 text-amber-600',
    error: 'bg-red-500/10 text-red-500',
    idle: 'bg-surface-2 text-text-tertiary'
  }
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${styles[status] || styles.idle}`}>
      {status}
    </span>
  )
}

function TriggerBadge({ trigger }: { trigger: { type: string; schedule?: string } }) {
  const info = TRIGGER_LABELS[trigger.type] || TRIGGER_LABELS.manual
  const Icon = info.icon
  const extra = trigger.type === 'schedule' && trigger.schedule
    ? ` · ${trigger.schedule.replace(/_/g, ' ')}`
    : ''

  return (
    <span className="flex items-center gap-1 text-[11px] text-text-tertiary bg-surface-1 px-2 py-0.5 rounded-full">
      <Icon className="w-3 h-3" />
      {info.label}{extra}
    </span>
  )
}
