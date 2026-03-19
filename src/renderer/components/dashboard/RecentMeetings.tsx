import { useRecentMeetings } from '../../hooks/useVault'
import { Video, Users } from 'lucide-react'

export function RecentMeetings() {
  const { data: meetings, loading } = useRecentMeetings(5)

  if (loading) return <MeetingsSkeleton />

  return (
    <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2.5">
        <Video className="w-4.5 h-4.5 text-emerald-400" />
        <h2 className="font-semibold text-sm">Recent Meetings</h2>
      </div>

      <ul className="divide-y divide-border">
        {meetings.map((meeting, i) => (
          <li
            key={i}
            className="px-5 py-3.5 hover:bg-surface-2/30 transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">{meeting.title}</p>
                {meeting.attendees.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Users className="w-3 h-3 text-text-tertiary flex-shrink-0" />
                    <p className="text-xs text-text-tertiary truncate">
                      {meeting.attendees.join(', ')}
                    </p>
                  </div>
                )}
                {meeting.preview && (
                  <p className="text-xs text-text-tertiary mt-1.5 line-clamp-2 leading-relaxed">
                    {meeting.preview}
                  </p>
                )}
              </div>
              <span className="text-xs text-text-tertiary whitespace-nowrap flex-shrink-0 mt-0.5">
                {formatDate(meeting.date)}
              </span>
            </div>
          </li>
        ))}

        {meetings.length === 0 && (
          <li className="px-5 py-8 text-center text-text-tertiary text-sm">
            No meetings found
          </li>
        )}
      </ul>
    </div>
  )
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function MeetingsSkeleton() {
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
