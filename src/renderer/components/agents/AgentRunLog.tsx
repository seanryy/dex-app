import { useState, useMemo, useEffect } from 'react'
import {
  Loader2, Wrench, XCircle, CheckCircle, ChevronDown, ChevronRight,
  Clock, Play, AlertTriangle, Ban
} from 'lucide-react'
import { marked } from 'marked'
import type { AgentRun, ToolStep } from '../../../preload/index'

interface AgentRunLogProps {
  run: AgentRun
  liveSteps?: ToolStep[]
  liveOutput?: string
  isLive?: boolean
}

export function AgentRunLog({ run, liveSteps, liveOutput, isLive }: AgentRunLogProps) {
  const steps = isLive && liveSteps?.length ? liveSteps : run.steps
  const output = isLive && liveOutput ? liveOutput : run.output

  return (
    <div className="space-y-3">
      <RunHeader run={run} isLive={isLive} />

      {steps.length > 0 && (
        <ToolStepsTrace steps={steps} defaultOpen={!!isLive} />
      )}

      {isLive && !output && steps.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-text-tertiary py-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Agent is starting up...
        </div>
      )}

      {output && (
        <RunOutput content={output} />
      )}
    </div>
  )
}

function RunHeader({ run, isLive }: { run: AgentRun; isLive?: boolean }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!isLive) return
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - run.startedAt) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [isLive, run.startedAt])

  const duration = isLive
    ? elapsed
    : run.finishedAt
      ? Math.round((run.finishedAt - run.startedAt) / 1000)
      : Math.round((Date.now() - run.startedAt) / 1000)

  const statusIcon = {
    running: <Loader2 className="w-4 h-4 text-accent animate-spin" />,
    completed: <CheckCircle className="w-4 h-4 text-green-500" />,
    error: <XCircle className="w-4 h-4 text-red-500" />,
    cancelled: <Ban className="w-4 h-4 text-text-tertiary" />
  }

  const triggerLabel = {
    manual: 'Manual run',
    schedule: 'Scheduled',
    file_change: 'File change'
  }

  const formatDuration = (s: number) => {
    if (s < 60) return `${s}s`
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return `${mins}m ${secs}s`
  }

  return (
    <div className="flex items-center gap-3 text-xs text-text-secondary">
      {statusIcon[run.status]}
      <span className="font-medium capitalize">{run.status}</span>
      <span className="text-text-tertiary">·</span>
      <span className="flex items-center gap-1">
        <Play className="w-3 h-3" />
        {triggerLabel[run.trigger]}
      </span>
      <span className="text-text-tertiary">·</span>
      <span className="flex items-center gap-1 tabular-nums">
        <Clock className="w-3 h-3" />
        {formatDuration(duration)}
      </span>
      <span className="text-text-tertiary ml-auto">
        {new Date(run.startedAt).toLocaleString()}
      </span>
    </div>
  )
}

function ToolStepsTrace({ steps, defaultOpen = false }: { steps: ToolStep[]; defaultOpen?: boolean }) {
  const [expanded, setExpanded] = useState(defaultOpen)
  const hasRunning = steps.some(s => s.status === 'running')
  const errorCount = steps.filter(s => s.status === 'error').length

  useEffect(() => {
    if (defaultOpen && steps.length > 0) setExpanded(true)
  }, [steps.length, defaultOpen])

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-1 border border-border
          hover:bg-surface-2/50 transition-colors text-xs w-full group"
      >
        {hasRunning ? (
          <Loader2 className="w-3 h-3 text-accent animate-spin" />
        ) : errorCount > 0 ? (
          <AlertTriangle className="w-3 h-3 text-amber-500" />
        ) : (
          <Wrench className="w-3 h-3 text-green-500" />
        )}

        <span className="text-text-secondary font-medium">
          {hasRunning
            ? `Working... (${steps.length} tool${steps.length !== 1 ? 's' : ''})`
            : `Used ${steps.length} tool${steps.length !== 1 ? 's' : ''}`
          }
        </span>

        {!hasRunning && (
          <span className="text-text-tertiary ml-auto mr-2">
            {Math.round(steps.reduce((sum, s) => sum + s.durationMs, 0) / 100) / 10}s
          </span>
        )}

        {expanded ? (
          <ChevronDown className="w-3 h-3 text-text-tertiary" />
        ) : (
          <ChevronRight className="w-3 h-3 text-text-tertiary" />
        )}
      </button>

      {expanded && (
        <div className="mt-1 ml-2 space-y-1">
          {steps.map((step, i) => (
            <ToolStepRow key={i} step={step} />
          ))}
        </div>
      )}
    </div>
  )
}

function ToolStepRow({ step }: { step: ToolStep }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-l-2 border-border pl-3 py-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs hover:bg-surface-1 rounded px-1 py-0.5 w-full text-left"
      >
        {step.status === 'running' ? (
          <Loader2 className="w-3 h-3 text-accent animate-spin flex-shrink-0" />
        ) : step.status === 'error' ? (
          <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
        ) : (
          <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
        )}
        <span className="text-text-primary font-mono">{step.tool}</span>
        <span className="text-text-tertiary">{step.server}</span>
        {step.durationMs > 0 && (
          <span className="text-text-tertiary ml-auto">{step.durationMs}ms</span>
        )}
      </button>

      {open && (
        <div className="ml-5 mt-1 space-y-1">
          <pre className="text-[10px] text-text-tertiary bg-surface-1 p-2 rounded overflow-x-auto">
            {JSON.stringify(step.args, null, 2)}
          </pre>
          {step.result && (
            <pre className="text-[10px] text-text-tertiary bg-surface-1 p-2 rounded overflow-x-auto max-h-32 overflow-y-auto">
              {step.result}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

function RunOutput({ content }: { content: string }) {
  const html = useMemo(() => {
    marked.setOptions({ breaks: true, gfm: true })
    return marked.parse(content) as string
  }, [content])

  return (
    <div className="bg-surface-1 border border-border rounded-lg p-4">
      <div
        className="md-viewer text-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
