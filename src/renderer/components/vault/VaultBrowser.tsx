import { useState, useEffect, useCallback } from 'react'
import {
  Search, FileText, ChevronRight, FolderOpen, Inbox, Target, CalendarCheck,
  CheckSquare, Briefcase, Users, Building2, User, BookOpen, Archive,
  Settings, Star, UtensilsCrossed, Lightbulb, FilePenLine
} from 'lucide-react'
import { MarkdownViewer } from './MarkdownViewer'
import type { FileTreeNode, SearchResult, VaultPerson } from '../../../preload/index'

function prettyName(name: string, isDirectory: boolean): string {
  let display = name

  // Strip numeric prefix from folders (00-Inbox → Inbox, 01-Quarter_Goals → Quarter Goals)
  display = display.replace(/^\d{2}-/, '')

  // Strip .md extension from files
  if (!isDirectory) {
    display = display.replace(/\.md$/, '')
  }

  // Replace underscores with spaces
  display = display.replace(/_/g, ' ')

  return display
}

function prettyPath(path: string): string {
  return path
    .split('/')
    .map(segment => {
      let s = segment.replace(/^\d{2}-/, '').replace(/_/g, ' ').replace(/\.md$/, '')
      return s
    })
    .join(' / ')
}

const FOLDER_ICONS: Record<string, typeof FolderOpen> = {
  '00-Inbox': Inbox,
  'Inbox': Inbox,
  'Ideas': Lightbulb,
  'Meetings': CalendarCheck,
  '01-Quarter_Goals': Target,
  'Quarter_Goals': Target,
  '02-Week_Priorities': Star,
  'Week_Priorities': Star,
  '03-Tasks': CheckSquare,
  'Tasks': CheckSquare,
  '04-Projects': Briefcase,
  'Projects': Briefcase,
  '05-Areas': Users,
  'People': User,
  'Internal': User,
  'External': User,
  'Companies': Building2,
  'Competitors': Building2,
  'Career': Target,
  'Personal': User,
  'Thought_Leadership': Lightbulb,
  '06-Resources': BookOpen,
  'Dex_System': Settings,
  'Recipes': UtensilsCrossed,
  'Learnings': BookOpen,
  '07-Archives': Archive,
  'System': Settings,
}

function getFolderIcon(name: string) {
  return FOLDER_ICONS[name] || FolderOpen
}

export function VaultBrowser({ initialFile }: { initialFile?: string | null }) {
  const [tree, setTree] = useState<FileTreeNode[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [people, setPeople] = useState<VaultPerson[]>([])

  useEffect(() => {
    window.dex.vault.getFileTree().then(setTree)
    window.dex.vault.getPeople().then(setPeople)
  }, [])

  useEffect(() => {
    if (initialFile) {
      setSelectedFile(initialFile)
      window.dex.vault.readFile(initialFile).then(setFileContent).catch(() => {})
    }
  }, [initialFile])

  const openFile = useCallback(async (path: string) => {
    setSelectedFile(path)
    const content = await window.dex.vault.readFile(path)
    setFileContent(content)
  }, [])

  const handleSave = useCallback(async (newContent: string) => {
    if (!selectedFile) return { success: false, error: 'No file selected' }
    const result = await window.dex.vault.writeFile(selectedFile, newContent)
    if (result.success) {
      setFileContent(newContent)
    }
    return result
  }, [selectedFile])

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    const results = await window.dex.vault.search(query)
    setSearchResults(results)
    setSearching(false)
  }, [])

  return (
    <div className="flex h-full">
      {/* File tree sidebar */}
      <div className="w-72 border-r border-border flex flex-col bg-surface-0 flex-shrink-0">

        {/* Search */}
        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2 bg-surface-1 border border-border rounded-lg px-3 py-2
            focus-within:border-accent/50 transition-colors">
            <Search className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search vault..."
              className="bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none flex-1"
            />
          </div>
        </div>

        {/* Tree or search results */}
        <div className="flex-1 overflow-y-auto py-1">
          {searchQuery.length >= 2 ? (
            <SearchResultsList
              results={searchResults}
              loading={searching}
              onSelect={(file) => openFile(file)}
            />
          ) : (
            <FileTree
              nodes={tree}
              selectedFile={selectedFile}
              onSelect={openFile}
              depth={0}
            />
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {selectedFile ? (
          <div className="h-full flex flex-col">
            <div className="flex items-center px-5 h-10 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <FilePenLine className="w-3.5 h-3.5" />
                <span className="truncate">{prettyPath(selectedFile)}</span>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <MarkdownViewer
                content={fileContent}
                filePath={selectedFile}
                onSave={handleSave}
                people={people}
                onNavigate={openFile}
              />
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-text-tertiary text-sm">
            Select a file to view
          </div>
        )}
      </div>
    </div>
  )
}

function FileTree({
  nodes,
  selectedFile,
  onSelect,
  depth
}: {
  nodes: FileTreeNode[]
  selectedFile: string | null
  onSelect: (path: string) => void
  depth: number
}) {
  return (
    <ul>
      {nodes.map(node => (
        <FileTreeItem
          key={node.path}
          node={node}
          selectedFile={selectedFile}
          onSelect={onSelect}
          depth={depth}
        />
      ))}
    </ul>
  )
}

function FileTreeItem({
  node,
  selectedFile,
  onSelect,
  depth
}: {
  node: FileTreeNode
  selectedFile: string | null
  onSelect: (path: string) => void
  depth: number
}) {
  const [expanded, setExpanded] = useState(depth === 0)
  const displayName = prettyName(node.name, node.isDirectory)

  if (node.isDirectory) {
    const IconComponent = getFolderIcon(node.name)

    return (
      <li>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-1 transition-colors"
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
          <ChevronRight
            className={`w-3 h-3 flex-shrink-0 transition-transform text-text-tertiary ${expanded ? 'rotate-90' : ''}`}
          />
          <IconComponent className="w-4 h-4 flex-shrink-0 text-text-tertiary" />
          <span className="truncate font-medium">{displayName}</span>
        </button>
        {expanded && node.children && (
          <FileTree
            nodes={node.children}
            selectedFile={selectedFile}
            onSelect={onSelect}
            depth={depth + 1}
          />
        )}
      </li>
    )
  }

  const isSelected = node.path === selectedFile

  return (
    <li>
      <button
        onClick={() => onSelect(node.path)}
        className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors truncate
          ${isSelected
            ? 'bg-accent/10 text-accent'
            : 'text-text-secondary hover:text-text-primary hover:bg-surface-1'
          }`}
        style={{ paddingLeft: `${depth * 16 + 28}px` }}
      >
        <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-accent/60' : 'text-text-tertiary/50'}`} />
        <span className="truncate">{displayName}</span>
      </button>
    </li>
  )
}

function SearchResultsList({
  results,
  loading,
  onSelect
}: {
  results: SearchResult[]
  loading: boolean
  onSelect: (file: string) => void
}) {
  if (loading) {
    return (
      <div className="px-4 py-6 text-center text-text-tertiary text-xs">
        Searching...
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-text-tertiary text-xs">
        No results
      </div>
    )
  }

  return (
    <ul className="py-1">
      {results.map((result, i) => (
        <li key={i}>
          <button
            onClick={() => onSelect(result.file)}
            className="w-full text-left px-3 py-2 hover:bg-surface-1 transition-colors"
          >
            <p className="text-xs text-accent truncate">{prettyPath(result.file)}</p>
            <p className="text-xs text-text-secondary mt-0.5 truncate">{result.text}</p>
          </button>
        </li>
      ))}
    </ul>
  )
}
