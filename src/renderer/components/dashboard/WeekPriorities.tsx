import { useState, useEffect } from 'react'
import { Target, CheckCircle2, Circle } from 'lucide-react'
import type { WeekPriority } from '../../../preload/index'

export function WeekPriorities() {
  const [priorities, setPriorities] = useState<WeekPriority[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.dex.briefing.getWeekPriorities()
      .then(setPriorities)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="h-4 w-28 bg-surface-2 rounded animate-pulse" />
        </div>
        <div className="p-3 space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 px-2 py-2">
              <div className="w-4 h-4 rounded-full bg-surface-2 animate-pulse" />
              <div className="h-3.5 bg-surface-2 rounded animate-pulse flex-1" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (priorities.length === 0) return null

  const done = priorities.filter(p => p.done).length
  const total = priorities.length
  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Target className="w-4.5 h-4.5 text-orange-400" />
          <h2 className="font-semibold text-sm">Week Priorities</h2>
        </div>
        <span className="text-xs text-text-tertiary">{done}/{total} done</span>
      </div>

      {/* Progress bar */}
      <div className="px-5 pt-3 pb-1">
        <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-400 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <ul className="px-3 py-2">
        {priorities.map((p, i) => (
          <li
            key={i}
            className="flex items-start gap-3 px-2 py-2 rounded-lg"
          >
            {p.done
              ? <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              : <Circle className="w-4 h-4 text-text-tertiary mt-0.5 flex-shrink-0" />
            }
            <span className={`text-sm leading-snug ${p.done ? 'text-text-tertiary line-through' : 'text-text-primary'}`}>
              {p.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
