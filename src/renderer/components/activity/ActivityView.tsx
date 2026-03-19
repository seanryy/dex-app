import { useState, useEffect, useCallback } from 'react'
import {
  FileText, FilePlus, FileX, Users, Calendar, FolderKanban, ListChecks,
  Swords, Building2, Lightbulb, Target, Star, BookOpen, ChevronDown,
  ChevronRight, Plus, Minus, RefreshCw, Undo2, Check, AlertCircle,
  ExternalLink
} from 'lucide-react'
import type { ActivityEntry, ActivityCategory } from '../../../preload/index'

const CATEGORY_ICONS: Record<string, typeof FileText> = {
  person: Users,
  meeting: Calendar,
  project: FolderKanban,
  task: ListChecks,
  competitor: Swords,
  company: Building2,
  idea: Lightbulb,
  goal: Target,
  career: Star,
  resource: BookOpen,
  note: FileText
}

const TYPE_ICONS: Record<string, { icon: typeof FileText; color: string; label: string }> = {
  created: { icon: FilePlus, color: 'text-green-500', label: 'Created' },
  modified: { icon: FileText, color: 'text-accent', label: 'Updated' },
  deleted: { icon: FileX, color: 'text-red-400', label: 'Removed' }
}

export function ActivityView({ onOpenFile }: { onOpenFile?: (path: string) => void }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [categories, setCategories] = useState<ActivityCategory[]>([])
  const [activeFilter, setActiveFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const loadActivity = useCallback(async () => {
    const [items, cats] = await Promise.all([
      window.dex.activity.getRecent(100, activeFilter),
      window.dex.activity.getCategories()
    ])
    setEntries(items)
    setCategories(cats)
    setLoading(false)
  }, [activeFilter])

  useEffect(() => {
    loadActivity()
  }, [loadActivity])

  useEffect(() => {
    const unsub = window.dex.activity.onNew((entry) => {
      if (activeFilter === 'all' || entry.category === activeFilter) {
        setEntries(prev => [entry, ...prev].slice(0, 100))
      }
      setCategories(prev => {
        const existing = prev.find(c => c.id === entry.category)
        if (existing) {
          return prev.map(c => c.id === entry.category ? { ...c, count: c.count + 1 } : c)
        }
        return [...prev, { id: entry.category, label: entry.category, count: 1 }]
      })
    })
    return unsub
  }, [activeFilter])

  const grouped = groupByTime(entries)

  return (
    <div className="flex h-full">
      {/* Filter sidebar */}
      <div className="w-52 flex-shrink-0 border-r border-border bg-surface-0 p-4 space-y-1">
        <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">Filter</h3>

        <FilterButton
          label="All Activity"
          count={entries.length}
          active={activeFilter === 'all'}
          onClick={() => setActiveFilter('all')}
        />

        <div className="h-px bg-border my-2" />

        {categories.map(cat => {
          const Icon = CATEGORY_ICONS[cat.id] || FileText
          return (
            <FilterButton
              key={cat.id}
              label={cat.label}
              count={cat.count}
              icon={Icon}
              active={activeFilter === cat.id}
              onClick={() => setActiveFilter(cat.id)}
            />
          )
        })}
      </div>

      {/* Activity timeline */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-text-primary">Activity</h2>
            <button
              onClick={loadActivity}
              className="p-2 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-1 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="text-sm text-text-tertiary py-8 text-center">Loading activity...</div>
          ) : entries.length === 0 ? (
            <EmptyState filter={activeFilter} />
          ) : (
            <div className="space-y-8">
              {grouped.map(group => (
                <TimeGroup key={group.label} label={group.label} entries={group.entries} onOpenFile={onOpenFile} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FilterButton({
  label, count, icon: Icon, active, onClick
}: {
  label: string; count: number; icon?: typeof FileText; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors
        ${active ? 'bg-accent/10 text-accent font-medium' : 'text-text-secondary hover:bg-surface-1'}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
      <span className="flex-1 text-left truncate">{label}</span>
      <span className={`text-[11px] tabular-nums ${active ? 'text-accent/70' : 'text-text-tertiary'}`}>{count}</span>
    </button>
  )
}

function TimeGroup({ label, entries, onOpenFile }: { label: string; entries: ActivityEntry[]; onOpenFile?: (path: string) => void }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">{label}</h3>
      <div className="space-y-1">
        {entries.map(entry => (
          <ActivityRow key={entry.id} entry={entry} onOpenFile={onOpenFile} />
        ))}
      </div>
    </div>
  )
}

function ActivityRow({ entry, onOpenFile }: { entry: ActivityEntry; onOpenFile?: (path: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [revertState, setRevertState] = useState<'idle' | 'confirm' | 'done' | 'error'>('idle')
  const [revertError, setRevertError] = useState('')
  const [canRevert, setCanRevert] = useState(entry.canRevert ?? false)

  const typeInfo = TYPE_ICONS[entry.type] || TYPE_ICONS.modified
  const TypeIcon = typeInfo.icon
  const CategoryIcon = CATEGORY_ICONS[entry.category] || FileText
  const hasDiff = (entry.linesAdded?.length || 0) > 0 || (entry.linesRemoved?.length || 0) > 0
  const isExpandable = hasDiff || canRevert || entry.type !== 'deleted'

  const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const revertLabel = {
    created: 'Delete this file',
    modified: 'Restore previous version',
    deleted: 'Restore deleted file'
  }

  async function handleRevert() {
    if (revertState === 'idle') {
      setRevertState('confirm')
      return
    }
    if (revertState === 'confirm') {
      const result = await window.dex.activity.revert(entry.id)
      if (result.success) {
        setRevertState('done')
        setCanRevert(false)
      } else {
        setRevertState('error')
        setRevertError(result.error || 'Failed')
      }
    }
  }

  function handleOpenFile(e: React.MouseEvent) {
    e.stopPropagation()
    if (onOpenFile && entry.type !== 'deleted') {
      onOpenFile(entry.path)
    }
  }

  return (
    <div className="group">
      <button
        onClick={() => isExpandable && setExpanded(!expanded)}
        className={`w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors
          ${isExpandable ? 'hover:bg-surface-1 cursor-pointer' : 'cursor-default'}
          ${expanded ? 'bg-surface-1' : ''}`}
      >
        <div className={`mt-0.5 ${typeInfo.color}`}>
          <TypeIcon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary truncate">{entry.label}</span>
            <span className="flex items-center gap-1 text-[11px] text-text-tertiary bg-surface-1 px-1.5 py-0.5 rounded-full flex-shrink-0">
              <CategoryIcon className="w-3 h-3" />
              {entry.category}
            </span>
          </div>
          <p className="text-[11px] text-text-tertiary mt-0.5 truncate font-mono">
            {entry.path}
          </p>
          {entry.summary && (
            <p className="text-xs text-text-secondary mt-0.5 truncate">{entry.summary}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {entry.type !== 'deleted' && onOpenFile && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleOpenFile}
              className="flex items-center gap-1 text-[11px] text-accent opacity-0 group-hover:opacity-100 hover:underline transition-opacity cursor-pointer"
            >
              <ExternalLink className="w-3 h-3" />
              View
            </span>
          )}
          <span className="text-[11px] text-text-tertiary tabular-nums">{time}</span>
          {isExpandable && (
            expanded
              ? <ChevronDown className="w-3 h-3 text-text-tertiary" />
              : <ChevronRight className="w-3 h-3 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="ml-10 mr-3 mb-2 space-y-2">
          {/* Diff */}
          {hasDiff && (
            <div className="rounded-lg bg-surface-0 border border-border overflow-hidden">
              {entry.linesAdded && entry.linesAdded.length > 0 && (
                <div className="border-b border-border last:border-b-0">
                  {entry.linesAdded.map((line, i) => (
                    <div key={`add-${i}`} className="flex items-start gap-2 px-3 py-1 bg-green-500/5 text-xs font-mono">
                      <Plus className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-green-400/90 break-all">{line}</span>
                    </div>
                  ))}
                </div>
              )}
              {entry.linesRemoved && entry.linesRemoved.length > 0 && (
                <div>
                  {entry.linesRemoved.map((line, i) => (
                    <div key={`rem-${i}`} className="flex items-start gap-2 px-3 py-1 bg-red-500/5 text-xs font-mono">
                      <Minus className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                      <span className="text-red-400/80 break-all">{line}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Open file button */}
          {entry.type !== 'deleted' && onOpenFile && (
            <button
              onClick={handleOpenFile}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Open in Vault
            </button>
          )}

          {/* Revert action */}
          {canRevert && revertState !== 'done' && (
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); handleRevert() }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${revertState === 'confirm'
                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                    : 'bg-surface-2 text-text-secondary hover:bg-surface-3'
                  }`}
              >
                <Undo2 className="w-3 h-3" />
                {revertState === 'confirm' ? 'Confirm revert' : 'Revert'}
              </button>
              {revertState === 'confirm' && (
                <>
                  <span className="text-[11px] text-text-tertiary">{revertLabel[entry.type]}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setRevertState('idle') }}
                    className="text-[11px] text-text-tertiary hover:text-text-secondary"
                  >
                    Cancel
                  </button>
                </>
              )}
              {revertState === 'error' && (
                <span className="flex items-center gap-1 text-[11px] text-red-400">
                  <AlertCircle className="w-3 h-3" />
                  {revertError}
                </span>
              )}
            </div>
          )}
          {revertState === 'done' && (
            <div className="flex items-center gap-1.5 text-[11px] text-green-500 font-medium px-1">
              <Check className="w-3 h-3" />
              Reverted successfully
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EmptyState({ filter }: { filter: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-surface-1 flex items-center justify-center mb-4">
        <FileText className="w-7 h-7 text-text-tertiary" />
      </div>
      <h3 className="text-base font-semibold text-text-primary mb-1">No activity yet</h3>
      <p className="text-sm text-text-secondary max-w-xs">
        {filter === 'all'
          ? 'Changes to your vault will appear here as they happen — file edits, new notes, agent updates, and more.'
          : `No ${filter} changes recorded yet. Activity will appear as files in this category are created or updated.`
        }
      </p>
    </div>
  )
}

interface TimeGroupData {
  label: string
  entries: ActivityEntry[]
}

function groupByTime(entries: ActivityEntry[]): TimeGroupData[] {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86_400_000
  const weekStart = todayStart - 7 * 86_400_000

  const groups: Record<string, ActivityEntry[]> = {
    'Today': [],
    'Yesterday': [],
    'This Week': [],
    'Earlier': []
  }

  for (const entry of entries) {
    if (entry.timestamp >= todayStart) {
      groups['Today'].push(entry)
    } else if (entry.timestamp >= yesterdayStart) {
      groups['Yesterday'].push(entry)
    } else if (entry.timestamp >= weekStart) {
      groups['This Week'].push(entry)
    } else {
      groups['Earlier'].push(entry)
    }
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, entries: items }))
}
