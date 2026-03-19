import { useState, useCallback } from 'react'
import { ArrowUp, Sparkles, Sun, Moon, Sunset } from 'lucide-react'
import { useConfig } from '../../hooks/useVault'
import { TaskList } from './TaskList'
import { ProjectCards } from './ProjectCards'
import { QuickActions } from './QuickActions'
import { MeetingBriefings } from './MeetingBriefings'
import { AgentOvernight } from './AgentOvernight'
import { WeekPriorities } from './WeekPriorities'
import { ActivityPulse } from './ActivityPulse'
import { RelationshipRadar } from './RelationshipRadar'
import { WeatherWidget } from './WeatherWidget'
import { NowPlayingWidget } from './NowPlayingWidget'

interface DashboardViewProps {
  onChatSubmit: (text: string) => void
}

export function DashboardView({ onChatSubmit }: DashboardViewProps) {
  const { data: config } = useConfig()
  const [chatInput, setChatInput] = useState('')

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const GreetingIcon = hour < 12 ? Sun : hour < 17 ? Sunset : Moon

  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })

  const dayOfWeek = now.getDay()
  const dayLabel = dayOfWeek === 1 ? 'Start the week strong.' :
    dayOfWeek === 5 ? 'Almost there — finish strong.' :
    dayOfWeek === 0 || dayOfWeek === 6 ? 'Enjoy the weekend.' : null

  const handleSubmit = useCallback(() => {
    const text = chatInput.trim()
    if (!text) return
    setChatInput('')
    onChatSubmit(text)
  }, [chatInput, onChatSubmit])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="pt-6 pb-2 px-8">
        <div className="flex items-center gap-3">
          <GreetingIcon className="w-5 h-5 text-accent" />
          <h1 className="text-2xl font-semibold text-text-primary">
            {greeting}, {config?.userName?.split(' ')[0] || 'there'}
          </h1>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-text-tertiary text-sm">{dateStr}</p>
          {dayLabel && (
            <>
              <span className="text-text-tertiary text-sm">·</span>
              <p className="text-text-tertiary text-sm italic">{dayLabel}</p>
            </>
          )}
        </div>
      </div>

      {/* Chat input */}
      <div className="px-8 pt-4 pb-2">
        <div className="relative max-w-2xl">
          <div className="flex items-center gap-3 bg-surface-1 border border-border rounded-xl px-4 py-3
            focus-within:border-accent/50 transition-colors">
            <Sparkles className="w-4 h-4 text-accent flex-shrink-0" />
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Dex anything..."
              className="bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none flex-1"
            />
            <button
              onClick={handleSubmit}
              disabled={!chatInput.trim()}
              className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
                ${chatInput.trim()
                  ? 'bg-accent text-white hover:bg-accent-hover'
                  : 'bg-surface-2 text-text-tertiary'
                }`}
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 pb-8 space-y-6">
        <QuickActions />

        {/* Agent overnight outputs */}
        <AgentOvernight />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left column — main briefing */}
          <div className="xl:col-span-2 space-y-6">
            <MeetingBriefings />
            <TaskList />
          </div>

          {/* Right column — context */}
          <div className="space-y-6">
            <NowPlayingWidget />
            <WeatherWidget />
            <WeekPriorities />
            <RelationshipRadar />
            <ActivityPulse />
            <ProjectCards />
          </div>
        </div>
      </div>
    </div>
  )
}
