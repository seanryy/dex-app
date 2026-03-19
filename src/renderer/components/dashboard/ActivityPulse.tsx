import { useState, useEffect } from 'react'
import { Activity, FilePlus, FileText, FileX } from 'lucide-react'
import type { ActivitySummary } from '../../../preload/index'

export function ActivityPulse() {
  const [summary, setSummary] = useState<ActivitySummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.dex.briefing.getActivitySummary()
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-surface-1 rounded-2xl border border-border p-5">
        <div className="h-4 w-20 bg-surface-2 rounded animate-pulse mb-3" />
        <div className="flex gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 w-16 bg-surface-2 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const total = (summary?.created || 0) + (summary?.modified || 0) + (summary?.deleted || 0)
  if (total === 0) return null

  return (
    <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Activity className="w-4.5 h-4.5 text-emerald-400" />
          <h2 className="font-semibold text-sm">Vault Pulse</h2>
        </div>
        <span className="text-xs text-text-tertiary">Last 24h</span>
      </div>

      <div className="p-4">
        <div className="flex gap-3">
          {summary!.created > 0 && (
            <StatPill icon={FilePlus} label="Created" count={summary!.created} color="text-green-500" bg="bg-green-500/10" />
          )}
          {summary!.modified > 0 && (
            <StatPill icon={FileText} label="Updated" count={summary!.modified} color="text-accent" bg="bg-accent/10" />
          )}
          {summary!.deleted > 0 && (
            <StatPill icon={FileX} label="Removed" count={summary!.deleted} color="text-red-400" bg="bg-red-500/10" />
          )}
        </div>

        {summary!.highlights.length > 0 && (
          <div className="mt-3 space-y-1">
            {summary!.highlights.slice(0, 3).map((h, i) => (
              <p key={i} className="text-xs text-text-secondary truncate">
                <span className="text-text-tertiary mr-1.5">·</span>
                {h}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatPill({ icon: Icon, label, count, color, bg }: {
  icon: typeof FilePlus; label: string; count: number; color: string; bg: string
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${bg}`}>
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <div>
        <p className={`text-sm font-semibold ${color} tabular-nums`}>{count}</p>
        <p className="text-[10px] text-text-tertiary uppercase tracking-wider">{label}</p>
      </div>
    </div>
  )
}
