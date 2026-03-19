import { useMemo } from 'react'
import { X, Send, Sparkles, Key } from 'lucide-react'
import { marked } from 'marked'
import { useChat } from '../../hooks/useChat'

interface ChatPanelProps {
  onClose: () => void
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const {
    messages, input, setInput, loading,
    hasApiKey, bottomRef, inputRef,
    send, setApiKey
  } = useChat()

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const handleSetApiKey = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const input = form.elements.namedItem('key') as HTMLInputElement
    if (input.value.trim()) {
      setApiKey(input.value.trim())
      input.value = ''
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface-0">
      <div className="flex items-center justify-between px-4 h-11 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="font-medium text-sm">Side Chat</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-surface-2 rounded-lg transition-colors text-text-tertiary hover:text-text-primary"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {hasApiKey === false && (
        <form onSubmit={handleSetApiKey} className="p-4 border-b border-border bg-surface-1">
          <div className="flex items-center gap-2 text-sm text-text-secondary mb-3">
            <Key className="w-4 h-4" />
            <span>Enter your Claude API key to chat</span>
          </div>
          <div className="flex gap-2">
            <input
              name="key"
              type="password"
              placeholder="sk-ant-..."
              className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary
                placeholder:text-text-tertiary focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-text-tertiary text-sm mt-12">
            <Sparkles className="w-8 h-8 mx-auto mb-3 text-accent/50" />
            <p>Ask me about your tasks, meetings, people, or projects.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-accent text-white rounded-br-md'
                  : 'bg-surface-2 text-text-primary rounded-bl-md'
                }`}
            >
              {msg.role === 'assistant'
                ? <SidebarMessageContent content={msg.content} />
                : msg.content
              }
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface-2 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="px-4 pb-4 pt-2 border-t border-border">
        <div className="flex items-end gap-2 bg-surface-1 border border-border rounded-2xl px-4 py-2
          focus-within:border-accent/50 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Dex anything..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary
              resize-none outline-none max-h-32 py-1"
            style={{ height: 'auto', minHeight: '24px' }}
            onInput={e => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              target.style.height = `${Math.min(target.scrollHeight, 128)}px`
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="p-1.5 rounded-lg transition-colors disabled:opacity-30
              text-accent hover:bg-accent/10 disabled:hover:bg-transparent"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function SidebarMessageContent({ content }: { content: string }) {
  const html = useMemo(() => {
    marked.setOptions({ breaks: true, gfm: true })
    return marked.parse(content) as string
  }, [content])

  return (
    <div
      className="md-viewer [&_p]:my-1 [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-sm"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
