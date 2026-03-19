import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Search, LayoutDashboard, FolderOpen, MessageSquare, Settings,
  User, FileText, CheckSquare, Slash, ArrowRight, Bot, Activity
} from 'lucide-react'
import type { View } from '../App'
import type { SkillInfo, VaultPerson, FileTreeNode } from '../../preload/index'

export interface PaletteAction {
  type: 'navigate' | 'openFile' | 'runCommand'
  view?: View
  path?: string
  command?: string
}

interface PaletteItem {
  id: string
  label: string
  sublabel?: string
  icon: typeof Search
  category: string
  action: PaletteAction
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onAction: (action: PaletteAction) => void
}

export function CommandPalette({ open, onClose, onAction }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [items, setItems] = useState<PaletteItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Load data when palette opens
  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelectedIdx(0)
    setTimeout(() => inputRef.current?.focus(), 50)

    loadItems().then(setItems)
  }, [open])

  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 20)
    const q = query.toLowerCase()
    return items
      .filter(item =>
        item.label.toLowerCase().includes(q) ||
        (item.sublabel && item.sublabel.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q)
      )
      .slice(0, 20)
  }, [query, items])

  // Group results by category
  const grouped = useMemo(() => {
    const groups: { category: string; items: PaletteItem[] }[] = []
    for (const item of filtered) {
      const existing = groups.find(g => g.category === item.category)
      if (existing) {
        existing.items.push(item)
      } else {
        groups.push({ category: item.category, items: [item] })
      }
    }
    return groups
  }, [filtered])

  useEffect(() => {
    setSelectedIdx(0)
  }, [query])

  const handleSelect = useCallback((item: PaletteItem) => {
    onAction(item.action)
    onClose()
  }, [onAction, onClose])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(prev => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIdx]) handleSelect(filtered[selectedIdx])
    }
  }

  if (!open) return null

  let flatIdx = 0

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-surface-1 border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Search className="w-5 h-5 text-text-tertiary flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files, people, commands..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none"
          />
          <kbd className="text-[10px] text-text-tertiary bg-surface-2 px-1.5 py-0.5 rounded border border-border font-mono">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-text-tertiary text-center py-8">No results for "{query}"</p>
          ) : (
            grouped.map(group => (
              <div key={group.category}>
                <div className="px-5 py-1.5">
                  <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">
                    {group.category}
                  </span>
                </div>
                {group.items.map(item => {
                  const idx = flatIdx++
                  const isSelected = idx === selectedIdx
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors
                        ${isSelected ? 'bg-accent/10' : 'hover:bg-surface-2/50'}`}
                    >
                      <item.icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-accent' : 'text-text-tertiary'}`} />
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm ${isSelected ? 'text-text-primary' : 'text-text-secondary'}`}>
                          {item.label}
                        </span>
                        {item.sublabel && (
                          <span className="text-[11px] text-text-tertiary ml-2">
                            {item.sublabel}
                          </span>
                        )}
                      </div>
                      {isSelected && <ArrowRight className="w-3.5 h-3.5 text-accent flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-2.5 flex items-center gap-4">
          <span className="text-[10px] text-text-tertiary flex items-center gap-1">
            <kbd className="bg-surface-2 px-1 py-0.5 rounded border border-border font-mono">↑↓</kbd> navigate
          </span>
          <span className="text-[10px] text-text-tertiary flex items-center gap-1">
            <kbd className="bg-surface-2 px-1 py-0.5 rounded border border-border font-mono">↵</kbd> open
          </span>
        </div>
      </div>
    </div>
  )
}

async function loadItems(): Promise<PaletteItem[]> {
  const items: PaletteItem[] = []

  // Navigation views
  const views: { id: View; label: string; icon: typeof Search }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'vault', label: 'Vault Browser', icon: FolderOpen },
    { id: 'chat', label: 'Chat with Dex', icon: MessageSquare },
    { id: 'agents', label: 'Agents', icon: Bot },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]

  for (const v of views) {
    items.push({
      id: `nav-${v.id}`,
      label: v.label,
      icon: v.icon,
      category: 'Navigation',
      action: { type: 'navigate', view: v.id }
    })
  }

  // Load skills, people, and files in parallel
  const [skills, people, fileTree] = await Promise.all([
    window.dex.vault.getSkills().catch(() => [] as SkillInfo[]),
    window.dex.vault.getPeople().catch(() => [] as VaultPerson[]),
    window.dex.vault.getFileTree().catch(() => [] as FileTreeNode[])
  ])

  for (const skill of skills) {
    items.push({
      id: `cmd-${skill.command}`,
      label: skill.command,
      sublabel: skill.description,
      icon: Slash,
      category: 'Commands',
      action: { type: 'runCommand', command: skill.command }
    })
  }

  for (const person of people) {
    items.push({
      id: `person-${person.name}`,
      label: person.name,
      sublabel: [person.role, person.company].filter(Boolean).join(' · ') || (person.internal ? 'Internal' : 'External'),
      icon: User,
      category: 'People',
      action: { type: 'openFile', path: person.path }
    })
  }

  // Flatten file tree (top-level files and one level deep)
  const flatFiles = flattenTree(fileTree, 2)
  for (const file of flatFiles.slice(0, 50)) {
    if (file.isDirectory) continue
    items.push({
      id: `file-${file.path}`,
      label: file.name,
      sublabel: file.path,
      icon: file.name.includes('Task') ? CheckSquare : FileText,
      category: 'Files',
      action: { type: 'openFile', path: file.path }
    })
  }

  return items
}

function flattenTree(nodes: FileTreeNode[], maxDepth: number, depth = 0): FileTreeNode[] {
  const result: FileTreeNode[] = []
  for (const node of nodes) {
    result.push(node)
    if (node.isDirectory && node.children && depth < maxDepth) {
      result.push(...flattenTree(node.children, maxDepth, depth + 1))
    }
  }
  return result
}
