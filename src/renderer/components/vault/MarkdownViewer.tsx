import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { marked } from 'marked'
import { Pencil, Eye, Save, Undo2 } from 'lucide-react'
import type { VaultPerson } from '../../../preload/index'

interface MarkdownViewerProps {
  content: string
  filePath?: string
  onSave?: (content: string) => Promise<{ success: boolean; error?: string }>
  people?: VaultPerson[]
  onNavigate?: (path: string) => void
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function MarkdownViewer({ content, filePath, onSave, people, onNavigate }: MarkdownViewerProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(content)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hasChanges = draft !== content

  useEffect(() => {
    setDraft(content)
    setEditing(false)
    setSaveStatus('idle')
  }, [content, filePath])

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [editing])

  const handleSave = useCallback(async () => {
    if (!onSave || !hasChanges) return
    setSaveStatus('saving')
    const result = await onSave(draft)
    if (result.success) {
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    } else {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }, [onSave, draft, hasChanges])

  const handleDiscard = useCallback(() => {
    setDraft(content)
    setEditing(false)
    setSaveStatus('idle')
  }, [content])

  useEffect(() => {
    if (!editing) return
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editing, handleSave])

  const handleTab = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart
      const end = ta.selectionEnd

      if (e.shiftKey) {
        const beforeCursor = draft.substring(0, start)
        const lastNewline = beforeCursor.lastIndexOf('\n')
        const lineStart = lastNewline + 1
        const linePrefix = draft.substring(lineStart, lineStart + 2)
        if (linePrefix === '  ') {
          const updated = draft.substring(0, lineStart) + draft.substring(lineStart + 2)
          setDraft(updated)
          requestAnimationFrame(() => {
            ta.selectionStart = Math.max(lineStart, start - 2)
            ta.selectionEnd = Math.max(lineStart, end - 2)
          })
        }
      } else {
        const updated = draft.substring(0, start) + '  ' + draft.substring(end)
        setDraft(updated)
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2
        })
      }
    }
  }, [draft])

  const personLookup = useMemo(() => {
    if (!people?.length) return new Map<string, string>()
    const map = new Map<string, string>()
    for (const p of people) {
      map.set(p.name.toLowerCase(), p.path)
      const underscored = p.name.replace(/ /g, '_').toLowerCase()
      map.set(underscored, p.path)
    }
    return map
  }, [people])

  function linkifyNames(html: string): string {
    if (!personLookup.size) return html

    const names = Array.from(new Set(
      (people || []).map(p => p.name)
    )).sort((a, b) => b.length - a.length)

    if (!names.length) return html

    const pattern = new RegExp(
      `(?<![\\w/])(?:${names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\w])`,
      'g'
    )

    return html.replace(pattern, (match) => {
      const path = personLookup.get(match.toLowerCase())
      if (!path) return match
      return `<a class="person-link" data-person-path="${path}">${match}</a>`
    })
  }

  const html = useMemo(() => {
    if (editing) return ''
    marked.setOptions({ breaks: true, gfm: true })
    const source = editing ? draft : content

    const cleaned = source
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_m, target, display) => {
        const key = target.trim().replace(/ /g, '_').toLowerCase()
        const path = personLookup.get(key)
        if (path) return `<a class="person-link" data-person-path="${path}">${display}</a>`
        return display
      })
      .replace(/\[\[([^\]]+)\]\]/g, (_m, name) => {
        const key = name.trim().replace(/ /g, '_').toLowerCase()
        const path = personLookup.get(key)
        const display = name.replace(/_/g, ' ')
        if (path) return `<a class="person-link" data-person-path="${path}">${display}</a>`
        return display
      })
      .replace(/\[\^task-\d{8}-\d{3}\]/g, '')

    const raw = marked.parse(cleaned) as string
    return linkifyNames(raw)
  }, [content, draft, editing, personLookup])

  const canEdit = !!onSave

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      {canEdit && (
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-border bg-surface-0 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setEditing(false)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors
                ${!editing
                  ? 'bg-surface-2 text-text-primary'
                  : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-1'
                }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </button>
            <button
              onClick={() => setEditing(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors
                ${editing
                  ? 'bg-surface-2 text-text-primary'
                  : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-1'
                }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          </div>

          <div className="flex items-center gap-2">
            {saveStatus === 'saved' && (
              <span className="text-xs text-success">Saved</span>
            )}
            {saveStatus === 'saving' && (
              <span className="text-xs text-text-tertiary">Saving...</span>
            )}
            {saveStatus === 'error' && (
              <span className="text-xs text-danger">Save failed</span>
            )}
            {editing && hasChanges && (
              <>
                <button
                  onClick={handleDiscard}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-text-tertiary
                    hover:text-text-secondary hover:bg-surface-1 transition-colors"
                >
                  <Undo2 className="w-3 h-3" />
                  Discard
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium
                    bg-accent text-white hover:bg-accent-hover transition-colors"
                >
                  <Save className="w-3 h-3" />
                  Save
                </button>
              </>
            )}
            {editing && !hasChanges && (
              <span className="text-xs text-text-tertiary">No changes</span>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {editing ? (
        <div className="flex-1 overflow-hidden">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleTab}
            spellCheck
            className="md-editor w-full h-full px-10 py-8 bg-surface-0 text-text-secondary
              resize-none outline-none font-mono text-sm leading-relaxed"
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div
            className="md-viewer px-10 py-8 max-w-4xl"
            dangerouslySetInnerHTML={{ __html: html }}
            onClick={(e) => {
              const target = e.target as HTMLElement
              const link = target.closest<HTMLAnchorElement>('.person-link')
              if (link) {
                e.preventDefault()
                const path = link.dataset.personPath
                if (path && onNavigate) onNavigate(path)
              }
            }}
          />
        </div>
      )}
    </div>
  )
}
