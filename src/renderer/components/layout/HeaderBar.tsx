import { Search, PanelRightOpen } from 'lucide-react'
import type { View } from '../../App'

interface HeaderBarProps {
  currentView: View
  chatSidebarOpen: boolean
  onToggleChatSidebar: () => void
  onOpenPalette: () => void
}

export function HeaderBar({ currentView, chatSidebarOpen, onToggleChatSidebar, onOpenPalette }: HeaderBarProps) {
  return (
    <div className="titlebar-drag flex items-center justify-end border-b border-border bg-surface-0 flex-shrink-0 h-11 pr-3"
    >
      <div className="titlebar-no-drag flex items-center gap-1.5">
        <button
          onClick={onOpenPalette}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-tertiary hover:text-text-secondary
            bg-surface-2/50 border border-border rounded-lg hover:bg-surface-2 transition-colors"
        >
          <Search className="w-3 h-3" />
          <span>Search</span>
          <kbd className="ml-1 text-[10px] text-text-tertiary/60 font-mono">⌘K</kbd>
        </button>

        {currentView !== 'chat' && (
          <button
            onClick={onToggleChatSidebar}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors
              ${chatSidebarOpen
                ? 'bg-accent/15 text-accent'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-2/50'
              }`}
            title="Toggle side chat (⌘J)"
          >
            <PanelRightOpen className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
