import {
  LayoutDashboard,
  FolderOpen,
  MessageSquare,
  Bot,
  Activity,
  Settings,
  Sparkles
} from 'lucide-react'
import type { View } from '../../App'

interface SidebarProps {
  currentView: View
  onNavigate: (view: View) => void
}

const navItems: { id: View; label: string; icon: typeof LayoutDashboard; shortcut?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: '1' },
  { id: 'vault', label: 'Vault', icon: FolderOpen, shortcut: '2' },
  { id: 'chat', label: 'Chat', icon: MessageSquare, shortcut: '3' },
  { id: 'agents', label: 'Agents', icon: Bot, shortcut: '4' },
  { id: 'activity', label: 'Activity', icon: Activity, shortcut: '5' },
  { id: 'settings', label: 'Settings', icon: Settings, shortcut: '6' }
]

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  return (
    <div className="w-16 bg-surface-0 border-r border-border flex flex-col items-center py-3 gap-1 flex-shrink-0">
      {/* Dex logo */}
      <div className="mb-2 flex items-center justify-center w-10 h-10 rounded-xl bg-accent/15">
        <Sparkles className="w-5 h-5 text-accent" />
      </div>

      {/* Separator */}
      <div className="w-8 h-px bg-border mb-2" />

      {navItems.map(item => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all group relative
            ${currentView === item.id
              ? 'bg-accent/15 text-accent'
              : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-2'
            }`}
          title={item.label}
        >
          <item.icon className="w-5 h-5" />
          <span className="absolute left-14 px-2.5 py-1.5 bg-surface-2 border border-border text-text-primary text-xs rounded-lg
            opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
            {item.label}
            {item.shortcut && (
              <span className="ml-2 text-text-tertiary">
                {'\u2318'}{item.shortcut}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  )
}
