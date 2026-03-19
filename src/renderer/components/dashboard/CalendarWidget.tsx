import { useState, useEffect } from 'react'
import { Calendar, Clock } from 'lucide-react'

interface CalendarEvent {
  title: string
  start: string
  end: string
  location?: string
}

export function CalendarWidget() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.dex.mcp
      .callTool('calendar', 'get_todays_calendar', {})
      .then((result) => {
        if (result && typeof result === 'object' && 'content' in (result as Record<string, unknown>)) {
          const content = (result as { content: { text: string }[] }).content
          if (content?.[0]?.text) {
            try {
              const parsed = JSON.parse(content[0].text)
              if (Array.isArray(parsed)) {
                setEvents(parsed)
              }
            } catch {
              // Calendar returned non-JSON (likely a text summary)
            }
          }
        }
      })
      .catch(() => {
        // Calendar MCP not available
      })
      .finally(() => setLoading(false))
  }, [])

  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Calendar className="w-4.5 h-4.5 text-blue-400" />
          <h2 className="font-semibold text-sm">Today</h2>
        </div>
        <span className="text-xs text-text-tertiary">{timeStr}</span>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-1 h-8 bg-surface-2 rounded-full animate-pulse" />
              <div className="flex-1 space-y-1">
                <div className="h-3.5 bg-surface-2 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-surface-2 rounded animate-pulse w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length > 0 ? (
        <ul className="p-3 space-y-1">
          {events.map((event, i) => (
            <li
              key={i}
              className="flex items-start gap-3 px-2 py-2.5 rounded-xl hover:bg-surface-2/50 transition-colors"
            >
              <div className="w-1 h-full min-h-[32px] bg-blue-400/40 rounded-full flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">{event.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3 h-3 text-text-tertiary" />
                  <span className="text-xs text-text-tertiary">
                    {formatTime(event.start)} – {formatTime(event.end)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-5 py-6 text-center text-text-tertiary text-sm">
          No events today
        </div>
      )}
    </div>
  )
}

function formatTime(timeStr: string): string {
  try {
    const date = new Date(timeStr)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  } catch {
    return timeStr
  }
}
