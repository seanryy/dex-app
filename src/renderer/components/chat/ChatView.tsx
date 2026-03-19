import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import {
  Send, Sparkles, Key, RotateCcw, Slash, ChevronDown, ChevronRight,
  Wrench, Loader2, CheckCircle2, XCircle, History, Trash2, X
} from 'lucide-react'
import { marked } from 'marked'
import { useChat } from '../../hooks/useChat'
import type { SkillInfo, ToolStep, ConversationSummary } from '../../../preload/index'

interface ChatViewProps {
  pendingMessage?: string | null
  onPendingConsumed?: () => void
}

export function ChatView({ pendingMessage, onPendingConsumed }: ChatViewProps = {}) {
  const {
    messages, input, setInput, loading,
    hasApiKey, bottomRef, inputRef,
    send, setApiKey, clearMessages,
    skills, activeSkill, liveSteps, streamingText,
    conversations, conversationId, loadConversation, deleteConversation
  } = useChat({ skipAutoLoad: !!pendingMessage })

  const [showCommands, setShowCommands] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const pendingHandled = useRef(false)

  useEffect(() => {
    if (pendingMessage && !pendingHandled.current && !loading) {
      pendingHandled.current = true
      send(pendingMessage)
      onPendingConsumed?.()
    }
  }, [pendingMessage, loading])

  const filteredSkills = useMemo(() => {
    if (!input.startsWith('/')) return []
    const query = input.slice(1).toLowerCase()
    return skills.filter(s =>
      s.command.slice(1).toLowerCase().includes(query) ||
      s.description.toLowerCase().includes(query)
    ).slice(0, 12)
  }, [input, skills])

  const handleInputChange = useCallback((value: string) => {
    setInput(value)
    setShowCommands(value.startsWith('/') && value.length < 30)
  }, [setInput])

  const handleSelectSkill = useCallback((skill: SkillInfo) => {
    setInput(skill.command)
    setShowCommands(false)
    inputRef.current?.focus()
  }, [setInput, inputRef])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      setShowCommands(false)
      send()
    }
    if (e.key === 'Escape') {
      setShowCommands(false)
    }
  }

  return (
    <div className="flex h-full">
      {/* History panel */}
      {showHistory && (
        <HistoryPanel
          conversations={conversations}
          activeId={conversationId}
          onSelect={(id) => { loadConversation(id); setShowHistory(false) }}
          onDelete={deleteConversation}
          onClose={() => setShowHistory(false)}
          onNewChat={() => { clearMessages(); setShowHistory(false) }}
        />
      )}

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between px-6 h-11 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            {activeSkill && (
              <span className="px-2 py-0.5 bg-accent/10 text-accent text-xs rounded-md font-medium">
                /{activeSkill}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors
                ${showHistory
                  ? 'text-accent bg-accent/10'
                  : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-1'
                }`}
            >
              <History className="w-3.5 h-3.5" />
              History
            </button>
            {messages.length > 0 && (
              <button
                onClick={clearMessages}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-tertiary
                  hover:text-text-secondary hover:bg-surface-1 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                New chat
              </button>
            )}
          </div>
        </div>

        {hasApiKey === false && <ApiKeyBanner onSave={setApiKey} />}

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
            {messages.length === 0 && !loading && <EmptyState skills={skills} onSelectSkill={handleSelectSkill} />}

            {messages.map((msg, i) => (
              <MessageBubble key={i} role={msg.role} content={msg.content} toolSteps={msg.toolSteps} />
            ))}

            {loading && (
              <>
                {liveSteps.length > 0 && (
                  <div className="flex justify-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <Sparkles className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <ToolStepsTrace steps={liveSteps} defaultOpen={true} />
                    </div>
                  </div>
                )}

                {streamingText ? (
                  <div className="flex justify-start gap-3">
                    {liveSteps.length === 0 && (
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                        <Sparkles className="w-3.5 h-3.5 text-accent" />
                      </div>
                    )}
                    <div className={`flex-1 min-w-0 ${liveSteps.length > 0 ? 'ml-10' : ''}`}>
                      <AssistantContent content={streamingText} />
                      <span className="inline-block w-2 h-4 bg-accent/60 animate-pulse rounded-sm ml-0.5 align-text-bottom" />
                    </div>
                  </div>
                ) : (
                  <TypingIndicator hasSteps={liveSteps.length > 0} />
                )}
              </>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-border bg-surface-0">
          <div className="max-w-3xl mx-auto px-6 py-4 relative">
            {showCommands && filteredSkills.length > 0 && (
              <div className="absolute bottom-full left-6 right-6 mb-2 bg-surface-1 border border-border
                rounded-xl shadow-xl overflow-hidden max-h-80 overflow-y-auto z-50">
                <div className="px-3 py-2 border-b border-border">
                  <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">Commands</span>
                </div>
                {filteredSkills.map(skill => (
                  <button
                    key={skill.command}
                    onClick={() => handleSelectSkill(skill)}
                    className="w-full text-left px-3 py-2.5 hover:bg-surface-2 transition-colors flex items-start gap-3"
                  >
                    <span className="text-accent font-mono text-sm font-medium mt-0.5 flex-shrink-0 w-40 truncate">
                      {skill.command}
                    </span>
                    <span className="text-xs text-text-tertiary leading-relaxed line-clamp-2">
                      {skill.description}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-end gap-3 bg-surface-1 border border-border rounded-2xl px-5 py-3
              focus-within:border-accent/40 transition-colors">
              <button
                onClick={() => { setInput('/'); setShowCommands(true); inputRef.current?.focus() }}
                className="p-1 rounded-md text-text-tertiary hover:text-accent hover:bg-accent/10 transition-colors flex-shrink-0 mb-0.5"
                title="Slash commands"
              >
                <Slash className="w-4 h-4" />
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => { if (input.startsWith('/')) setShowCommands(true) }}
                onBlur={() => setTimeout(() => setShowCommands(false), 200)}
                placeholder="Ask Dex anything or type / for commands..."
                rows={1}
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary
                  resize-none outline-none max-h-40 py-0.5 leading-relaxed"
                style={{ height: 'auto', minHeight: '24px' }}
                onInput={e => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = 'auto'
                  target.style.height = `${Math.min(target.scrollHeight, 160)}px`
                }}
              />
              <button
                onClick={() => { setShowCommands(false); send() }}
                disabled={!input.trim() || loading}
                className="p-2 rounded-xl transition-all disabled:opacity-20
                  bg-accent hover:bg-accent-hover text-white disabled:bg-surface-3 disabled:text-text-tertiary"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-text-tertiary mt-2 text-center">
              Type <span className="font-mono text-text-secondary">/</span> for commands — same skills as Dex in Cursor
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- History Panel ---

function HistoryPanel({
  conversations, activeId, onSelect, onDelete, onClose, onNewChat
}: {
  conversations: ConversationSummary[]
  activeId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onClose: () => void
  onNewChat: () => void
}) {
  const formatDate = (ts: number) => {
    const d = new Date(ts)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long' })
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="w-72 border-r border-border bg-surface-0 flex flex-col flex-shrink-0">
      <div className="flex items-center justify-between px-4 h-14 border-b border-border flex-shrink-0">
        <span className="text-sm font-medium text-text-primary">History</span>
        <button onClick={onClose} className="p-1 hover:bg-surface-2 rounded-lg text-text-tertiary hover:text-text-primary transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3">
        <button
          onClick={onNewChat}
          className="w-full px-3 py-2 text-sm text-accent bg-accent/5 hover:bg-accent/10 border border-accent/20
            rounded-xl transition-colors font-medium"
        >
          + New conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {conversations.length === 0 ? (
          <p className="text-xs text-text-tertiary text-center mt-8 px-4">
            No conversations yet. Start chatting and they'll appear here.
          </p>
        ) : (
          <div className="space-y-0.5">
            {conversations.map(conv => (
              <div
                key={conv.id}
                className={`group flex items-start gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors
                  ${activeId === conv.id ? 'bg-accent/10 text-accent' : 'hover:bg-surface-1 text-text-secondary'}`}
                onClick={() => onSelect(conv.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${activeId === conv.id ? 'text-accent font-medium' : 'text-text-primary'}`}>
                    {conv.title}
                  </p>
                  <p className="text-[11px] text-text-tertiary mt-0.5">
                    {formatDate(conv.updatedAt)} · {conv.messageCount} msgs
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(conv.id) }}
                  className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-surface-2
                    text-text-tertiary hover:text-danger transition-all flex-shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Tool Steps Trace (collapsible) ---

function ToolStepsTrace({ steps, defaultOpen = false }: { steps: ToolStep[]; defaultOpen?: boolean }) {
  const [expanded, setExpanded] = useState(defaultOpen)
  const hasRunning = steps.some(s => s.status === 'running')
  const errorCount = steps.filter(s => s.status === 'error').length

  return (
    <div className="mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-1 border border-border
          hover:bg-surface-2/50 transition-colors text-xs w-full group"
      >
        {hasRunning ? (
          <Loader2 className="w-3 h-3 text-accent animate-spin" />
        ) : errorCount > 0 ? (
          <XCircle className="w-3 h-3 text-warning" />
        ) : (
          <Wrench className="w-3 h-3 text-success" />
        )}

        <span className="text-text-secondary font-medium">
          {hasRunning
            ? `Working... (${steps.length} tool${steps.length !== 1 ? 's' : ''})`
            : `Used ${steps.length} tool${steps.length !== 1 ? 's' : ''}`
          }
        </span>

        {!hasRunning && (
          <span className="text-text-tertiary ml-auto">
            {Math.round(steps.reduce((sum, s) => sum + s.durationMs, 0) / 1000 * 10) / 10}s
          </span>
        )}

        {expanded
          ? <ChevronDown className="w-3 h-3 text-text-tertiary ml-auto" />
          : <ChevronRight className="w-3 h-3 text-text-tertiary ml-auto" />
        }
      </button>

      {expanded && (
        <div className="mt-1.5 space-y-1">
          {steps.map((step, i) => (
            <ToolStepRow key={i} step={step} />
          ))}
        </div>
      )}
    </div>
  )
}

function ToolStepRow({ step }: { step: ToolStep }) {
  const [showResult, setShowResult] = useState(false)

  const argSummary = Object.entries(step.args)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(', ')
    .slice(0, 80)

  return (
    <div className="rounded-lg bg-surface-0 border border-border overflow-hidden">
      <button
        onClick={() => step.status !== 'running' && setShowResult(!showResult)}
        className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-surface-1/50 transition-colors"
      >
        {step.status === 'running' ? (
          <Loader2 className="w-3 h-3 text-accent animate-spin flex-shrink-0" />
        ) : step.status === 'error' ? (
          <XCircle className="w-3 h-3 text-danger flex-shrink-0" />
        ) : (
          <CheckCircle2 className="w-3 h-3 text-success flex-shrink-0" />
        )}

        <span className="text-[11px] font-mono text-accent font-medium flex-shrink-0">
          {step.tool}
        </span>

        {step.server !== 'unknown' && (
          <span className="text-[10px] px-1.5 py-0.5 bg-surface-2 text-text-tertiary rounded flex-shrink-0">
            {step.server}
          </span>
        )}

        <span className="text-[11px] text-text-tertiary truncate flex-1">
          {argSummary}
        </span>

        {step.status !== 'running' && (
          <span className="text-[10px] text-text-tertiary flex-shrink-0">
            {step.durationMs}ms
          </span>
        )}
      </button>

      {showResult && step.result && (
        <div className="border-t border-border px-3 py-2 bg-surface-1/30">
          <pre className="text-[11px] text-text-tertiary font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto leading-relaxed">
            {step.result}
          </pre>
        </div>
      )}
    </div>
  )
}

// --- Message Bubble ---

function MessageBubble({ role, content, toolSteps }: { role: 'user' | 'assistant'; content: string; toolSteps?: ToolStep[] }) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-surface-2 text-text-primary rounded-2xl rounded-br-md px-5 py-3 text-sm leading-relaxed">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start gap-3">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 mt-1">
        <Sparkles className="w-3.5 h-3.5 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        {toolSteps && toolSteps.length > 0 && (
          <ToolStepsTrace steps={toolSteps} />
        )}
        <AssistantContent content={content} />
      </div>
    </div>
  )
}

function AssistantContent({ content }: { content: string }) {
  const html = useMemo(() => {
    marked.setOptions({ breaks: true, gfm: true })
    return marked.parse(content) as string
  }, [content])

  return (
    <div
      className="md-viewer text-sm"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function TypingIndicator({ hasSteps }: { hasSteps: boolean }) {
  return (
    <div className="flex justify-start gap-3">
      {!hasSteps && (
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
        </div>
      )}
      <div className={`bg-surface-1 rounded-2xl rounded-bl-md px-5 py-3.5 ${hasSteps ? 'ml-10' : ''}`}>
        <div className="flex gap-1.5">
          <span className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

// --- Empty State ---

function EmptyState({ skills, onSelectSkill }: { skills: SkillInfo[]; onSelectSkill: (s: SkillInfo) => void }) {
  const quickSkills = skills.filter(s =>
    ['/daily-plan', '/process-meetings', '/meeting-prep', '/project-health', '/week-review', '/triage'].includes(s.command)
  )

  return (
    <div className="flex flex-col items-center justify-center pt-20 pb-12">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/20 to-purple-500/20 flex items-center justify-center mb-5">
        <Sparkles className="w-7 h-7 text-accent" />
      </div>
      <h2 className="text-lg font-semibold text-text-primary mb-2">Chat with Dex</h2>
      <p className="text-sm text-text-tertiary max-w-sm text-center leading-relaxed mb-6">
        Ask about your tasks, meetings, people, or projects.
        Use slash commands for structured workflows.
      </p>

      <div className="flex flex-wrap gap-2 justify-center max-w-lg mb-6">
        {['What are my open tasks?', 'Summarize recent meetings', 'What projects are active?'].map(suggestion => (
          <button
            key={suggestion}
            className="px-3 py-1.5 text-xs text-text-secondary bg-surface-1 border border-border
              rounded-full hover:border-border-hover hover:text-text-primary transition-colors"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {quickSkills.length > 0 && (
        <div className="w-full max-w-md">
          <p className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-2 text-center">Quick commands</p>
          <div className="grid grid-cols-2 gap-1.5">
            {quickSkills.map(skill => (
              <button
                key={skill.command}
                onClick={() => onSelectSkill(skill)}
                className="text-left px-3 py-2.5 bg-surface-1 border border-border rounded-xl
                  hover:border-border-hover hover:bg-surface-2/50 transition-colors group"
              >
                <span className="text-accent font-mono text-xs font-medium">{skill.command}</span>
                <p className="text-[11px] text-text-tertiary mt-0.5 line-clamp-1 group-hover:text-text-secondary transition-colors">
                  {skill.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ApiKeyBanner({ onSave }: { onSave: (key: string) => void }) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const input = form.elements.namedItem('apikey') as HTMLInputElement
    if (input.value.trim()) {
      onSave(input.value.trim())
      input.value = ''
    }
  }

  return (
    <div className="border-b border-border bg-surface-1/50">
      <div className="max-w-3xl mx-auto px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-3">
          <Key className="w-4 h-4 text-warning" />
          <span>Enter your Claude API key to start chatting</span>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            name="apikey"
            type="password"
            placeholder="sk-ant-api03-..."
            className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary
              placeholder:text-text-tertiary focus:outline-none focus:border-accent/50"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
          >
            Save Key
          </button>
        </form>
      </div>
    </div>
  )
}
