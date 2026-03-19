import { useState, useEffect } from 'react'
import { Calendar, Clock, User2, MessageSquare, ChevronDown, ChevronRight } from 'lucide-react'
import type { UpcomingMeetingBriefing } from '../../../preload/index'

export function MeetingBriefings() {
  const [meetings, setMeetings] = useState<UpcomingMeetingBriefing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.dex.briefing.getMeetingBriefings()
      .then(setMeetings)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <BriefingSkeleton />

  const now = new Date()
  const upcoming = meetings.filter(m => new Date(m.start) > now)
  const current = meetings.find(m => {
    const start = new Date(m.start)
    const end = new Date(m.end)
    return now >= start && now <= end
  })

  if (meetings.length === 0) {
    return (
      <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2.5">
          <Calendar className="w-4.5 h-4.5 text-blue-400" />
          <h2 className="font-semibold text-sm">Today's Meetings</h2>
        </div>
        <div className="px-5 py-8 text-center text-text-tertiary text-sm">
          No meetings today — deep work day
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Calendar className="w-4.5 h-4.5 text-blue-400" />
          <h2 className="font-semibold text-sm">Today's Meetings</h2>
        </div>
        <span className="text-xs text-text-tertiary">{meetings.length} scheduled</span>
      </div>

      <div className="divide-y divide-border">
        {current && <MeetingRow meeting={current} isCurrent />}
        {upcoming.map((m, i) => (
          <MeetingRow key={i} meeting={m} />
        ))}
        {!current && upcoming.length === 0 && meetings.map((m, i) => (
          <MeetingRow key={i} meeting={m} />
        ))}
      </div>
    </div>
  )
}

function MeetingRow({ meeting, isCurrent }: { meeting: UpcomingMeetingBriefing; isCurrent?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const start = new Date(meeting.start)
  const end = new Date(meeting.end)
  const timeStr = `${formatTime(start)} – ${formatTime(end)}`
  const hasContext = meeting.attendees.some(a => a.hasPersonPage || a.lastMeetingDate)

  return (
    <div className={`${isCurrent ? 'bg-blue-500/5 border-l-2 border-l-blue-400' : ''}`}>
      <button
        onClick={() => hasContext && setExpanded(!expanded)}
        className={`w-full text-left px-5 py-3.5 transition-colors group
          ${hasContext ? 'hover:bg-surface-2/30 cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {isCurrent && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-400 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  Now
                </span>
              )}
              <p className="text-sm font-medium text-text-primary truncate">{meeting.title}</p>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1 text-xs text-text-tertiary">
                <Clock className="w-3 h-3" />
                {timeStr}
              </span>
              {meeting.attendees.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-text-tertiary">
                  <User2 className="w-3 h-3" />
                  {meeting.attendees.map(a => a.name.split(' ')[0]).join(', ')}
                </span>
              )}
            </div>
          </div>
          {hasContext && (
            expanded
              ? <ChevronDown className="w-3.5 h-3.5 text-text-tertiary mt-1" />
              : <ChevronRight className="w-3.5 h-3.5 text-text-tertiary mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-3.5 space-y-2">
          {meeting.attendees.filter(a => a.hasPersonPage || a.role).map((attendee, i) => (
            <div key={i} className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-surface-0 border border-border">
              <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-accent">
                  {attendee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary">{attendee.name}</p>
                {attendee.role && (
                  <p className="text-xs text-text-secondary">
                    {attendee.role}{attendee.company ? ` · ${attendee.company}` : ''}
                  </p>
                )}
                {attendee.lastMeetingDate && (
                  <p className="flex items-center gap-1 text-[11px] text-text-tertiary mt-1">
                    <MessageSquare className="w-3 h-3" />
                    Last met {formatRelativeDate(attendee.lastMeetingDate)}
                    {attendee.lastMeetingTopic ? ` — ${attendee.lastMeetingTopic}` : ''}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000)
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return `${Math.floor(diffDays / 30)} months ago`
}

function BriefingSkeleton() {
  return (
    <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="h-4 w-32 bg-surface-2 rounded animate-pulse" />
      </div>
      <div className="divide-y divide-border">
        {[1, 2, 3].map(i => (
          <div key={i} className="px-5 py-4 space-y-2">
            <div className="h-4 bg-surface-2 rounded animate-pulse w-2/3" />
            <div className="h-3 bg-surface-2 rounded animate-pulse w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}
