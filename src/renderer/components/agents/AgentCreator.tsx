import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, ChevronDown, Sparkles } from 'lucide-react'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'
import type { AgentTemplate, AgentDefinition } from '../../../preload/index'

const SCHEDULE_OPTIONS = [
  { value: 'every_morning', label: 'Every morning (8 AM)' },
  { value: 'every_hour', label: 'Every hour' },
  { value: 'end_of_day', label: 'End of day (6 PM)' },
  { value: 'every_15_minutes', label: 'Every 15 minutes' }
]

interface AgentCreatorProps {
  templates: AgentTemplate[]
  editingAgent?: AgentDefinition | null
  onSave: (agent: AgentDefinition) => void
  onCancel: () => void
}

type Step = 'templates' | 'configure'

export function AgentCreator({ templates, editingAgent, onSave, onCancel }: AgentCreatorProps) {
  const [step, setStep] = useState<Step>(editingAgent ? 'configure' : 'templates')
  const isEditing = !!editingAgent

  const [name, setName] = useState(editingAgent?.name || '')
  const [description, setDescription] = useState(editingAgent?.description || '')
  const [icon, setIcon] = useState(editingAgent?.icon || '✨')
  const [systemPrompt, setSystemPrompt] = useState(editingAgent?.systemPrompt || '')
  const [triggerType, setTriggerType] = useState<'manual' | 'schedule' | 'file_change'>(editingAgent?.trigger.type || 'manual')
  const [schedule, setSchedule] = useState(editingAgent?.trigger.schedule || 'every_morning')
  const [watchPaths, setWatchPaths] = useState(editingAgent?.trigger.watchPaths?.join(', ') || '')
  const [maxRounds, setMaxRounds] = useState(editingAgent?.maxRounds || 30)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const emojiPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false)
      }
    }
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [showEmojiPicker])

  function selectTemplate(template: AgentTemplate) {
    setName(template.name)
    setDescription(template.description)
    setIcon(template.icon)
    setSystemPrompt(template.systemPrompt)
    setTriggerType(template.trigger.type)
    if (template.trigger.schedule) setSchedule(template.trigger.schedule)
    if (template.trigger.watchPaths) setWatchPaths(template.trigger.watchPaths.join(', '))
    setMaxRounds(template.maxRounds)
    setStep('configure')
  }

  function handleSave() {
    const now = Date.now()
    const agent: AgentDefinition = {
      id: editingAgent?.id || crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      icon,
      systemPrompt: systemPrompt.trim(),
      trigger: {
        type: triggerType,
        ...(triggerType === 'schedule' ? { schedule } : {}),
        ...(triggerType === 'file_change' ? { watchPaths: watchPaths.split(',').map(p => p.trim()).filter(Boolean) } : {})
      },
      maxRounds,
      enabled: editingAgent?.enabled ?? true,
      createdAt: editingAgent?.createdAt || now,
      updatedAt: now
    }
    onSave(agent)
  }

  const canSave = name.trim() && systemPrompt.trim()

  if (step === 'templates') {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors">
            <ArrowLeft className="w-4 h-4 text-text-secondary" />
          </button>
          <h2 className="text-lg font-semibold text-text-primary">Create Agent</h2>
        </div>

        <p className="text-sm text-text-secondary">
          Pick a template to start with, or create a custom agent from scratch.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {templates.map(tpl => (
            <button
              key={tpl.id}
              onClick={() => selectTemplate(tpl)}
              className="text-left p-4 rounded-xl border border-border bg-surface-1 hover:border-accent/40
                hover:bg-accent/5 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0
                  group-hover:bg-accent/20 transition-colors text-lg">
                  {tpl.icon}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm text-text-primary">{tpl.name}</div>
                  <div className="text-xs text-text-tertiary mt-1 line-clamp-2">{tpl.description}</div>
                </div>
              </div>
            </button>
          ))}

          <button
            onClick={() => setStep('configure')}
            className="text-left p-4 rounded-xl border border-dashed border-border bg-surface-0
              hover:border-accent/40 hover:bg-accent/5 transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center flex-shrink-0
                group-hover:bg-accent/10 transition-colors">
                <Sparkles className="w-4.5 h-4.5 text-text-tertiary group-hover:text-accent" />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-sm text-text-primary">Custom Agent</div>
                <div className="text-xs text-text-tertiary mt-1">Build from scratch with your own instructions.</div>
              </div>
            </div>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(100vh-120px)]">
      <div className="flex items-center gap-3">
        {!isEditing && (
          <button onClick={() => setStep('templates')} className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors">
            <ArrowLeft className="w-4 h-4 text-text-secondary" />
          </button>
        )}
        {isEditing && (
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors">
            <ArrowLeft className="w-4 h-4 text-text-secondary" />
          </button>
        )}
        <h2 className="text-lg font-semibold text-text-primary">
          {isEditing ? 'Edit Agent' : 'Configure Agent'}
        </h2>
      </div>

      {/* Name + Icon */}
      <div className="flex gap-3">
        <div className="relative">
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Icon</label>
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="w-11 h-11 rounded-lg bg-surface-1 border border-border hover:border-accent/40 transition-colors
              flex items-center justify-center text-xl cursor-pointer"
          >
            {icon}
          </button>
          {showEmojiPicker && (
            <div ref={emojiPickerRef} className="absolute top-full left-0 mt-1 z-50">
              <Picker
                data={data}
                onEmojiSelect={(emoji: { native: string }) => {
                  setIcon(emoji.native)
                  setShowEmojiPicker(false)
                }}
                theme="dark"
                previewPosition="none"
                skinTonePosition="search"
                maxFrequentRows={2}
                perLine={8}
              />
            </div>
          )}
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="My Agent"
            className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary
              placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">Description</label>
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What does this agent do?"
          className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2 text-sm text-text-primary
            placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* System Prompt */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          System Prompt (instructions for the agent)
        </label>
        <textarea
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          rows={8}
          placeholder="Tell the agent what to do, what files to read/write, and how to report results..."
          className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2 text-sm text-text-primary
            placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent resize-y
            font-mono leading-relaxed"
        />
      </div>

      {/* Trigger Type */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">Trigger</label>
        <div className="relative">
          <select
            value={triggerType}
            onChange={e => setTriggerType(e.target.value as typeof triggerType)}
            className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2 text-sm text-text-primary
              focus:outline-none focus:ring-1 focus:ring-accent appearance-none cursor-pointer"
          >
            <option value="manual">Manual only</option>
            <option value="schedule">On a schedule</option>
            <option value="file_change">When files change</option>
          </select>
          <ChevronDown className="w-4 h-4 text-text-tertiary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {triggerType === 'schedule' && (
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Schedule</label>
          <div className="relative">
            <select
              value={schedule}
              onChange={e => setSchedule(e.target.value)}
              className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2 text-sm text-text-primary
                focus:outline-none focus:ring-1 focus:ring-accent appearance-none cursor-pointer"
            >
              {SCHEDULE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-text-tertiary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      )}

      {triggerType === 'file_change' && (
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Watch paths (comma-separated, relative to vault)
          </label>
          <input
            value={watchPaths}
            onChange={e => setWatchPaths(e.target.value)}
            placeholder="00-Inbox/, 00-Inbox/Meetings/"
            className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2 text-sm text-text-primary
              placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent font-mono"
          />
        </div>
      )}

      {/* Max rounds */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          Max tool rounds ({maxRounds})
        </label>
        <input
          type="range"
          min={5}
          max={50}
          value={maxRounds}
          onChange={e => setMaxRounds(parseInt(e.target.value))}
          className="w-full accent-[var(--color-accent)]"
        />
        <div className="flex justify-between text-[10px] text-text-tertiary mt-0.5">
          <span>5 (quick)</span>
          <span>50 (thorough)</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="flex-1 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium
            transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isEditing ? 'Save Changes' : 'Create Agent'}
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2.5 bg-surface-2 hover:bg-surface-3 text-text-secondary rounded-lg text-sm
            font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
