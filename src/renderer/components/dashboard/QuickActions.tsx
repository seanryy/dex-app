import { Plus, FileText, Zap } from 'lucide-react'

const actions = [
  { label: 'New Task', icon: Plus, color: 'text-accent' },
  { label: 'Quick Note', icon: FileText, color: 'text-emerald-400' },
  { label: 'Process Meetings', icon: Zap, color: 'text-amber-400' }
]

export function QuickActions() {
  return (
    <div className="flex gap-3">
      {actions.map(action => (
        <button
          key={action.label}
          className="flex items-center gap-2 px-4 py-2.5 bg-surface-1 border border-border rounded-xl
            hover:border-border-hover hover:bg-surface-2/50 transition-all text-sm group"
        >
          <action.icon className={`w-4 h-4 ${action.color}`} />
          <span className="text-text-secondary group-hover:text-text-primary transition-colors">
            {action.label}
          </span>
        </button>
      ))}
    </div>
  )
}
