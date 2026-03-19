import { useState, useEffect, useMemo } from 'react'
import { Users, AlertTriangle, TrendingUp, Clock, MessageSquare } from 'lucide-react'
import type { VaultPerson, VaultMeeting } from '../../../preload/index'

interface PersonWithActivity extends VaultPerson {
  lastMet?: string
  daysSinceContact: number
  meetingCount: number
  status: 'hot' | 'warm' | 'cooling' | 'cold'
}

export function RelationshipRadar() {
  const [people, setPeople] = useState<VaultPerson[]>([])
  const [meetings, setMeetings] = useState<VaultMeeting[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'cooling' | 'hot' | 'all'>('cooling')

  useEffect(() => {
    Promise.all([
      window.dex.vault.getPeople(),
      window.dex.vault.getRecentMeetings(50)
    ])
      .then(([p, m]) => { setPeople(p); setMeetings(m) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const enriched = useMemo(() => {
    const now = new Date()
    const realPeople = people.filter(p =>
      !p.name.toLowerCase().includes('readme') && !p.path.toLowerCase().endsWith('readme.md')
    )
    return realPeople.map(person => {
      const firstName = person.name.split(' ')[0].toLowerCase()
      const lastName = person.name.split(' ').slice(-1)[0]?.toLowerCase() || ''

      const personMeetings = meetings.filter(m => {
        const searchStr = `${m.title} ${m.attendees.join(' ')} ${m.preview}`.toLowerCase()
        return searchStr.includes(firstName) && (lastName.length < 3 || searchStr.includes(lastName))
      })

      const lastMeeting = personMeetings[0]
      const lastMetDate = lastMeeting?.date
      const daysSince = lastMetDate
        ? Math.floor((now.getTime() - new Date(lastMetDate + 'T00:00:00').getTime()) / 86_400_000)
        : 999

      let status: PersonWithActivity['status'] = 'warm'
      if (daysSince <= 3) status = 'hot'
      else if (daysSince <= 14) status = 'warm'
      else if (daysSince <= 30) status = 'cooling'
      else status = 'cold'

      return {
        ...person,
        lastMet: lastMetDate,
        daysSinceContact: daysSince,
        meetingCount: personMeetings.length,
        status
      } as PersonWithActivity
    }).filter(p => p.meetingCount > 0)
  }, [people, meetings])

  const cooling = enriched.filter(p => p.status === 'cooling' || p.status === 'cold').sort((a, b) => b.daysSinceContact - a.daysSinceContact)
  const hot = enriched.filter(p => p.status === 'hot').sort((a, b) => a.daysSinceContact - b.daysSinceContact)

  if (loading) {
    return (
      <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="h-4 w-32 bg-surface-2 rounded animate-pulse" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-surface-2 animate-pulse" />
              <div className="flex-1 space-y-1">
                <div className="h-3.5 bg-surface-2 rounded animate-pulse w-1/2" />
                <div className="h-3 bg-surface-2 rounded animate-pulse w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (enriched.length === 0) return null

  const displayPeople = view === 'cooling' ? cooling : view === 'hot' ? hot : enriched
  const hasAlerts = cooling.length > 0

  return (
    <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Users className="w-4.5 h-4.5 text-rose-400" />
          <h2 className="font-semibold text-sm">Relationship Radar</h2>
          {hasAlerts && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full">
              <AlertTriangle className="w-2.5 h-2.5" />
              {cooling.length}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <TabButton label="Cooling" active={view === 'cooling'} onClick={() => setView('cooling')} />
          <TabButton label="Active" active={view === 'hot'} onClick={() => setView('hot')} />
          <TabButton label="All" active={view === 'all'} onClick={() => setView('all')} />
        </div>
      </div>

      <ul className="p-2 max-h-[340px] overflow-y-auto">
        {displayPeople.slice(0, 10).map(person => (
          <PersonRow key={person.path} person={person} />
        ))}
        {displayPeople.length === 0 && (
          <li className="px-3 py-6 text-center text-text-tertiary text-sm">
            {view === 'cooling'
              ? 'All relationships are warm — nice work'
              : view === 'hot'
                ? 'No recent interactions'
                : 'No relationship data yet'
            }
          </li>
        )}
      </ul>
    </div>
  )
}

function PersonRow({ person }: { person: PersonWithActivity }) {
  const initials = person.name.split(' ').map(n => n[0]).join('').slice(0, 2)

  const statusConfig = {
    hot: { color: 'bg-green-500', ring: 'ring-green-500/20' },
    warm: { color: 'bg-blue-400', ring: 'ring-blue-400/20' },
    cooling: { color: 'bg-amber-400', ring: 'ring-amber-400/20' },
    cold: { color: 'bg-red-400', ring: 'ring-red-400/20' }
  }

  const cfg = statusConfig[person.status]

  return (
    <li className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-2/50 transition-colors group">
      <div className={`relative w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center flex-shrink-0 ring-2 ${cfg.ring}`}>
        <span className="text-xs font-semibold text-text-secondary">{initials}</span>
        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${cfg.color} ring-2 ring-surface-1`} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{person.name}</p>
        <p className="text-xs text-text-tertiary truncate">
          {person.role || (person.internal ? 'Internal' : 'External')}
          {person.company ? ` · ${person.company}` : ''}
        </p>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="flex items-center gap-1 text-[11px] text-text-tertiary tabular-nums">
          <MessageSquare className="w-3 h-3" />
          {person.meetingCount}
        </span>
        {person.lastMet ? (
          <span className={`flex items-center gap-1 text-[11px] tabular-nums ${
            person.status === 'cold' ? 'text-red-400' :
            person.status === 'cooling' ? 'text-amber-400' :
            'text-text-tertiary'
          }`}>
            <Clock className="w-3 h-3" />
            {formatDaysAgo(person.daysSinceContact)}
          </span>
        ) : (
          <span className="text-[11px] text-text-tertiary">No meetings</span>
        )}
      </div>
    </li>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 text-[11px] rounded-md transition-colors
        ${active ? 'bg-accent/10 text-accent font-medium' : 'text-text-tertiary hover:text-text-secondary'}`}
    >
      {label}
    </button>
  )
}

function formatDaysAgo(days: number): string {
  if (days === 0) return 'Today'
  if (days === 1) return '1d ago'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}
