import { useState, useEffect, useCallback } from 'react'
import { useTheme } from './hooks/useTheme'
import { Sidebar } from './components/layout/Sidebar'
import { HeaderBar } from './components/layout/HeaderBar'
import { ChatPanel } from './components/layout/ChatPanel'
import { DashboardView } from './components/dashboard/DashboardView'
import { VaultBrowser } from './components/vault/VaultBrowser'
import { ChatView } from './components/chat/ChatView'
import { SettingsView } from './components/settings/SettingsView'
import { AgentsView } from './components/agents/AgentsView'
import { ActivityView } from './components/activity/ActivityView'
import { CommandPalette, type PaletteAction } from './components/CommandPalette'

export type View = 'dashboard' | 'vault' | 'chat' | 'agents' | 'activity' | 'settings'

declare global {
  interface Window {
    dex: import('../preload/index').DexAPI
  }
}

export default function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false)
  const [vaultReady, setVaultReady] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [pendingChatMessage, setPendingChatMessage] = useState<string | null>(null)
  const [pendingVaultFile, setPendingVaultFile] = useState<string | null>(null)

  useTheme()

  useEffect(() => {
    window.dex.system.getVaultPath().then((path) => {
      setVaultReady(!!path)
    })
  }, [])

  const openVaultFile = useCallback((path: string) => {
    setPendingVaultFile(path)
    setCurrentView('vault')
  }, [])

  const handlePaletteAction = useCallback((action: PaletteAction) => {
    if (action.type === 'navigate' && action.view) {
      setCurrentView(action.view)
      if (action.view === 'chat') setChatSidebarOpen(false)
    } else if (action.type === 'openFile' && action.path) {
      openVaultFile(action.path)
    } else if (action.type === 'runCommand' && action.command) {
      setCurrentView('chat')
      setChatSidebarOpen(false)
    }
  }, [openVaultFile])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const meta = e.metaKey || e.ctrlKey

    if (meta && e.key === 'k') {
      e.preventDefault()
      setPaletteOpen(prev => !prev)
    }
    if (meta && e.key === 'j') {
      e.preventDefault()
      if (currentView === 'chat') return
      setChatSidebarOpen(prev => !prev)
    }
    if (meta && e.key === '1') {
      e.preventDefault()
      setCurrentView('dashboard')
    }
    if (meta && e.key === '2') {
      e.preventDefault()
      setCurrentView('vault')
    }
    if (meta && e.key === '3') {
      e.preventDefault()
      setCurrentView('chat')
      setChatSidebarOpen(false)
    }
    if (meta && e.key === '4') {
      e.preventDefault()
      setCurrentView('agents')
    }
    if (meta && e.key === '5') {
      e.preventDefault()
      setCurrentView('activity')
    }
    if (meta && e.key === '6') {
      e.preventDefault()
      setCurrentView('settings')
    }
    if (e.key === 'Escape' && chatSidebarOpen) {
      setChatSidebarOpen(false)
    }
  }, [chatSidebarOpen, currentView])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleNavigate = useCallback((view: View) => {
    setCurrentView(view)
    if (view !== 'vault') setPendingVaultFile(null)
    if (view === 'chat') setChatSidebarOpen(false)
  }, [])

  const showSidebarChat = chatSidebarOpen && currentView !== 'chat'

  return (
    <div className="flex flex-col h-screen bg-surface-0">
      {/* Full-width header */}
      {vaultReady && (
        <HeaderBar
          currentView={currentView}
          chatSidebarOpen={chatSidebarOpen}
          onToggleChatSidebar={() => setChatSidebarOpen(!chatSidebarOpen)}
          onOpenPalette={() => setPaletteOpen(true)}
        />
      )}

      {/* Sidebar + content below header */}
      <div className="flex flex-1 overflow-hidden">
        {vaultReady && (
          <Sidebar
            currentView={currentView}
            onNavigate={handleNavigate}
          />
        )}

        <main className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-auto">
            {!vaultReady ? (
              <VaultSetup onComplete={() => setVaultReady(true)} />
            ) : currentView === 'dashboard' ? (
              <DashboardView onChatSubmit={(text) => {
                setPendingChatMessage(text)
                setCurrentView('chat')
                setChatSidebarOpen(false)
              }} />
            ) : currentView === 'vault' ? (
              <VaultBrowser initialFile={pendingVaultFile} key={pendingVaultFile || 'vault'} />
            ) : currentView === 'chat' ? (
              <ChatView pendingMessage={pendingChatMessage} onPendingConsumed={() => setPendingChatMessage(null)} />
            ) : currentView === 'agents' ? (
              <AgentsView />
            ) : currentView === 'activity' ? (
              <ActivityView onOpenFile={openVaultFile} />
            ) : currentView === 'settings' ? (
              <SettingsView />
            ) : null}
          </div>

          {showSidebarChat && (
            <div className="w-[400px] border-l border-border flex-shrink-0">
              <ChatPanel onClose={() => setChatSidebarOpen(false)} />
            </div>
          )}
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onAction={handlePaletteAction}
      />
    </div>
  )
}

function VaultSetup({ onComplete }: { onComplete: () => void }) {
  const handleSelect = async () => {
    const path = await window.dex.system.showOpenDialog()
    if (path) {
      await window.dex.system.setVaultPath(path)
      onComplete()
    }
  }

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md space-y-6">
        <div className="text-6xl font-bold tracking-tight bg-gradient-to-br from-accent to-purple-400 bg-clip-text text-transparent">
          Dex
        </div>
        <p className="text-text-secondary text-lg">
          Point Dex at your vault to get started.
        </p>
        <button
          onClick={handleSelect}
          className="px-6 py-3 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors"
        >
          Select Vault Folder
        </button>
      </div>
    </div>
  )
}
