import { useState, useEffect } from 'react'
import { Bot, CheckCircle2, ChevronDown, ChevronRight, Clock } from 'lucide-react'
import type { AgentBriefingItem } from '../../../preload/index'

export function AgentOvernight() {
  const [items, setItems] = useState<AgentBriefingItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.dex.briefing.getAgentOvernight()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="h-4 w-28 bg-surface-2 rounded animate-pulse" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-10 bg-surface-2 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (items.length === 0) return null

  return (
    <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Bot className="w-4.5 h-4.5 text-purple-400" />
          <h2 className="font-semibold text-sm">Agent Updates</h2>
        </div>
        <span className="text-xs text-text-tertiary">Last 24h</span>
      </div>

      <div className="divide-y divide-border">
        {items.map(item => (
          <AgentOutputRow key={item.runId} item={item} />
        ))}
      </div>
    </div>
  )
}

function extractKeyFindings(text: string): string[] {
  const lines = text.split('\n').filter(l => l.trim())
  const findings: string[] = []

  for (const line of lines) {
    const cleaned = line
      .replace(/^#+\s*/, '')
      .replace(/\*\*/g, '')
      .replace(/^[-*•]\s*/, '')
      .replace(/^\d+\.\s*/, '')
      .trim()

    if (!cleaned) continue
    if (cleaned.length < 10) continue
    if (/^(summary|overview|analysis|report|update|result)/i.test(cleaned)) continue

    findings.push(cleaned.length > 100 ? cleaned.slice(0, 100) + '...' : cleaned)
    if (findings.length >= 3) break
  }

  return findings
}

function AgentOutputRow({ item }: { item: AgentBriefingItem }) {
  const [expanded, setExpanded] = useState(false)
  const time = new Date(item.completedAt)
  const timeStr = time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const findings = extractKeyFindings(item.outputPreview)

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-3.5 hover:bg-surface-2/30 transition-colors group"
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 text-base">
            {item.agentIcon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-text-primary">{item.agentName}</p>
              <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
              <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
                <Clock className="w-3 h-3" />
                {timeStr}
              </span>
            </div>
            {findings.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {findings.map((f, i) => (
                  <li key={i} className="text-xs text-text-secondary truncate flex items-start gap-1.5">
                    <span className="text-accent mt-0.5 flex-shrink-0">·</span>
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 mt-1">
            {expanded
              ? <ChevronDown className="w-3.5 h-3.5 text-text-tertiary" />
              : <ChevronRight className="w-3.5 h-3.5 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
            }
          </div>
        </div>
      </button>

      {expanded && item.outputPreview && (
        <div className="px-5 pb-3.5">
          <div className="ml-11 px-3 py-2.5 rounded-lg bg-surface-0 border border-border">
            <p className="text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">
              {item.outputPreview}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
