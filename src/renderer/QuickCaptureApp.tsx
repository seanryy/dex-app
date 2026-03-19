import { useState, useEffect, useRef, useCallback } from 'react'
import { StickyNote, CheckSquare, Mic, Check } from 'lucide-react'

type CaptureType = 'note' | 'task' | 'meeting'

const TYPES: { id: CaptureType; label: string; icon: typeof StickyNote; placeholder: string }[] = [
  { id: 'note', label: 'Note', icon: StickyNote, placeholder: 'Capture a thought...' },
  { id: 'task', label: 'Task', icon: CheckSquare, placeholder: 'Add a task...' },
  { id: 'meeting', label: 'Meeting', icon: Mic, placeholder: 'Meeting note...' },
]

function formatDate() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

function titleFromContent(text: string): string {
  const first = text.split('\n')[0].trim()
  const cleaned = first.replace(/[^\w\s-]/g, '').trim()
  return cleaned.slice(0, 60) || 'Quick Capture'
}

export default function QuickCaptureApp() {
  const [type, setType] = useState<CaptureType>('note')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem('dex-theme-mode')
    if (stored) document.documentElement.setAttribute('data-theme', stored)

    const accentRaw = localStorage.getItem('dex-accent-color')
    if (accentRaw) {
      try {
        const accent = JSON.parse(accentRaw)
        document.documentElement.style.setProperty('--accent-h', String(accent.hsl[0]))
        document.documentElement.style.setProperty('--accent-s', accent.hsl[1] + '%')
        document.documentElement.style.setProperty('--accent-l', accent.hsl[2] + '%')
      } catch { /* use defaults */ }
    }
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
  }, [type])

  const cycleType = useCallback(() => {
    const idx = TYPES.findIndex(t => t.id === type)
    setType(TYPES[(idx + 1) % TYPES.length].id)
  }, [type])

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || saving) return

    setSaving(true)
    const date = formatDate()
    let result: { success: boolean; error?: string }

    try {
      if (type === 'task') {
        result = await window.dex.vault.appendToFile(
          '03-Tasks/Tasks.md',
          `\n- [ ] ${trimmed}\n`
        )
      } else if (type === 'meeting') {
        const title = titleFromContent(trimmed)
        result = await window.dex.vault.writeFile(
          `00-Inbox/Meetings/${date} - ${title}.md`,
          `# ${title}\n\n**Date:** ${date}\n\n${trimmed}\n`
        )
      } else {
        const title = titleFromContent(trimmed)
        result = await window.dex.vault.writeFile(
          `00-Inbox/Ideas/${date} - ${title}.md`,
          `# ${title}\n\n${trimmed}\n`
        )
      }

      if (result.success) {
        setSaved(true)
        setText('')
        setTimeout(() => {
          setSaved(false)
          window.dex.quickCapture.hide()
        }, 900)
      } else {
        console.error('Save failed:', result.error)
      }
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setSaving(false)
    }
  }, [text, type, saving])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      window.dex.quickCapture.hide()
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      cycleType()
    }
  }, [handleSubmit, cycleType])

  const activeType = TYPES.find(t => t.id === type)!

  if (saved) {
    return (
      <div className="h-full flex items-start justify-center pt-2 px-2">
        <div className="w-full rounded-2xl border border-success/30 bg-surface-0 overflow-hidden"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          <div className="flex items-center justify-center gap-2 py-8">
            <div className="w-8 h-8 rounded-full bg-success/15 flex items-center justify-center">
              <Check className="w-4 h-4 text-success" />
            </div>
            <span className="text-sm font-medium text-success">
              {type === 'task' ? 'Task added' : type === 'meeting' ? 'Meeting note saved' : 'Note saved'}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex items-start justify-center pt-2 px-2">
      <div
        className="w-full rounded-2xl border border-border bg-surface-0 overflow-hidden"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4)', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Type selector */}
        <div className="flex items-center gap-1 px-3 pt-3 pb-1">
          {TYPES.map(t => {
            const Icon = t.icon
            const active = type === t.id
            return (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all
                  ${active
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-2/50'
                  }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            )
          })}
          <span className="ml-auto text-[10px] text-text-tertiary/50 font-mono">Tab to switch</span>
        </div>

        {/* Input */}
        <div className="px-3 pb-3 pt-1">
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={activeType.placeholder}
            rows={3}
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-tertiary/60
              outline-none resize-none leading-relaxed"
            disabled={saving}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-0">
          <div className="flex items-center gap-2 text-[10px] text-text-tertiary/40 font-mono">
            <span>↵ save</span>
            <span>⇧↵ newline</span>
            <span>esc dismiss</span>
          </div>
        </div>
      </div>
    </div>
  )
}
