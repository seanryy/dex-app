import { useState, useEffect, useCallback } from 'react'
import { useConfig } from '../../hooks/useVault'
import { useTheme, ACCENT_PRESETS, type ThemeMode } from '../../hooks/useTheme'
import {
  FolderOpen, Key, Check, Info, Palette, Sun, Moon, Plug, Zap,
  RefreshCw, ChevronDown, ChevronRight, Circle, Wrench, Power,
  PowerOff, Terminal, Search
} from 'lucide-react'
import type { McpServerStatus, SkillInfo } from '../../../preload/index'

type SettingsTab = 'setup' | 'preferences' | 'mcp' | 'skills'

const TABS: { id: SettingsTab; label: string; icon: typeof FolderOpen }[] = [
  { id: 'setup', label: 'Setup', icon: Key },
  { id: 'preferences', label: 'Preferences', icon: Palette },
  { id: 'mcp', label: 'MCP Servers', icon: Plug },
  { id: 'skills', label: 'Skills', icon: Zap },
]

export function SettingsView() {
  const [tab, setTab] = useState<SettingsTab>('setup')

  return (
    <div className="flex h-full">
      {/* Settings sidebar */}
      <div className="w-48 border-r border-border bg-surface-0 flex-shrink-0 py-4 px-2">
        <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider px-3 mb-2">Settings</p>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors mb-0.5
              ${tab === t.id
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-1'
              }`}
          >
            <t.icon className="w-4 h-4 flex-shrink-0" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-6">
          {tab === 'setup' && <SetupTab />}
          {tab === 'preferences' && <PreferencesTab />}
          {tab === 'mcp' && <McpTab />}
          {tab === 'skills' && <SkillsTab />}
        </div>
      </div>
    </div>
  )
}

/* ── Setup Tab ───────────────────────────────────────────────── */

function SetupTab() {
  const { data: config } = useConfig()
  const [hasApiKey, setHasApiKey] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.dex.chat.getApiKeyStatus().then(setHasApiKey)
  }, [])

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return
    await window.dex.chat.setApiKey(apiKeyInput.trim())
    setHasApiKey(true)
    setApiKeyInput('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleChangeVault = async () => {
    const path = await window.dex.system.showOpenDialog()
    if (path) {
      await window.dex.system.setVaultPath(path)
      window.location.reload()
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Setup</h1>
        <p className="text-sm text-text-tertiary mt-1">Connect Dex to your vault and configure your API key</p>
      </div>

      {/* Vault Path */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-text-primary flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-text-tertiary" />
          Vault Location
        </h2>
        <div className="bg-surface-1 border border-border rounded-xl p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text-secondary truncate font-mono">
                {config?.vaultPath || 'Not set'}
              </p>
              {config?.userName && (
                <p className="text-xs text-text-tertiary mt-1">
                  Logged in as {config.userName}
                </p>
              )}
            </div>
            <button
              onClick={handleChangeVault}
              className="px-3 py-1.5 text-sm bg-surface-2 hover:bg-surface-3 text-text-secondary
                rounded-lg transition-colors flex-shrink-0"
            >
              Change
            </button>
          </div>
        </div>
      </section>

      {/* API Key */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-text-primary flex items-center gap-2">
          <Key className="w-4 h-4 text-text-tertiary" />
          Claude API Key
        </h2>
        <div className="bg-surface-1 border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${hasApiKey ? 'bg-success' : 'bg-text-tertiary'}`} />
            <span className="text-sm text-text-secondary">
              {hasApiKey ? 'API key configured' : 'No API key set'}
            </span>
          </div>

          <div className="flex gap-2">
            <input
              type="password"
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              placeholder={hasApiKey ? 'Enter new key to replace...' : 'sk-ant-api03-...'}
              className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm
                text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50"
              onKeyDown={e => e.key === 'Enter' && handleSaveApiKey()}
            />
            <button
              onClick={handleSaveApiKey}
              disabled={!apiKeyInput.trim()}
              className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-30
                text-white rounded-lg text-sm transition-colors flex items-center gap-1.5"
            >
              {saved ? <Check className="w-3.5 h-3.5" /> : null}
              {saved ? 'Saved' : 'Save'}
            </button>
          </div>

          <p className="text-xs text-text-tertiary flex items-start gap-1.5">
            <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
            Your key is encrypted with macOS Keychain and never leaves your machine.
          </p>
        </div>
      </section>

      {/* Pillars */}
      {config?.pillars && config.pillars.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-text-primary">Strategic Pillars</h2>
          <div className="bg-surface-1 border border-border rounded-xl divide-y divide-border overflow-hidden">
            {config.pillars.map(pillar => (
              <div key={pillar.name} className="px-4 py-3">
                <p className="text-sm text-text-primary">{pillar.name}</p>
                <p className="text-xs text-text-tertiary mt-0.5">
                  {pillar.keywords.slice(0, 6).join(', ')}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* About */}
      <section className="pt-4 border-t border-border">
        <p className="text-xs text-text-tertiary">
          Dex Desktop v0.1.0 — Built with Electron + React
        </p>
      </section>
    </div>
  )
}

/* ── Preferences Tab ─────────────────────────────────────────── */

function PreferencesTab() {
  const { mode, accent, setMode, setAccent } = useTheme()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Preferences</h1>
        <p className="text-sm text-text-tertiary mt-1">Customize how Dex looks and feels</p>
      </div>

      <section className="space-y-4">
        <div className="bg-surface-1 border border-border rounded-xl p-5 space-y-6">
          {/* Mode */}
          <div>
            <p className="text-sm font-medium text-text-primary mb-2.5">Theme</p>
            <div className="flex gap-2">
              {([
                { id: 'light' as ThemeMode, label: 'Light', Icon: Sun },
                { id: 'dark' as ThemeMode, label: 'Dark', Icon: Moon },
              ]).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setMode(id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border
                    ${mode === id
                      ? 'bg-accent/15 text-accent border-accent/30'
                      : 'bg-surface-2/50 text-text-secondary border-border hover:bg-surface-2'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Accent color */}
          <div>
            <p className="text-sm font-medium text-text-primary mb-2.5">Accent color</p>
            <div className="flex flex-wrap gap-2.5">
              {ACCENT_PRESETS.map(preset => {
                const isActive = preset.name === accent.name
                const color = `hsl(${preset.hsl[0]}, ${preset.hsl[1]}%, ${preset.hsl[2]}%)`
                return (
                  <button
                    key={preset.name}
                    onClick={() => setAccent(preset)}
                    className={`group relative w-9 h-9 rounded-xl transition-all
                      ${isActive ? 'scale-110' : 'hover:scale-110'}`}
                    style={{
                      background: color,
                      outline: isActive ? `2px solid ${color}` : 'none',
                      outlineOffset: '3px'
                    }}
                    title={preset.name}
                  >
                    {isActive && (
                      <Check className="w-4 h-4 text-white absolute inset-0 m-auto drop-shadow-sm" />
                    )}
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-text-tertiary
                      opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      {preset.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

/* ── MCP Tab ─────────────────────────────────────────────────── */

function McpTab() {
  const [servers, setServers] = useState<McpServerStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadStatuses = useCallback(async () => {
    const statuses = await window.dex.mcp.getServerStatuses()
    setServers(statuses)
    setLoading(false)
  }, [])

  useEffect(() => { loadStatuses() }, [loadStatuses])

  const handleRefresh = async () => {
    setRefreshing(true)
    await window.dex.mcp.reloadConfig()
    await loadStatuses()
    setRefreshing(false)
  }

  const handleConnect = async (name: string) => {
    const result = await window.dex.mcp.connectServer(name)
    if (result.success) await loadStatuses()
  }

  const handleDisconnect = async (name: string) => {
    await window.dex.mcp.disconnectServer(name)
    await loadStatuses()
  }

  const connectedCount = servers.filter(s => s.connected).length
  const totalTools = servers.reduce((sum, s) => sum + s.toolCount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">MCP Servers</h1>
          <p className="text-sm text-text-tertiary mt-1">Manage the Model Context Protocol servers that power Dex</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary bg-surface-1
            border border-border rounded-lg hover:bg-surface-2 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Reload
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Configured" value={servers.length} />
        <StatCard label="Connected" value={connectedCount} color={connectedCount > 0 ? 'text-success' : undefined} />
        <StatCard label="Tools" value={totalTools} color={totalTools > 0 ? 'text-accent' : undefined} />
      </div>

      {/* Server list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-surface-1 border border-border rounded-xl p-4 animate-pulse">
              <div className="h-4 w-32 bg-surface-2 rounded" />
              <div className="h-3 w-48 bg-surface-2 rounded mt-2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {servers.map(server => (
            <ServerCard
              key={server.name}
              server={server}
              onConnect={() => handleConnect(server.name)}
              onDisconnect={() => handleDisconnect(server.name)}
            />
          ))}

          {servers.length === 0 && (
            <div className="bg-surface-1 border border-border rounded-xl p-8 text-center">
              <Plug className="w-8 h-8 text-text-tertiary mx-auto mb-3" />
              <p className="text-sm text-text-tertiary">
                No MCP servers configured. Add servers to your vault's <code className="text-accent">.mcp.json</code> file.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="bg-surface-1/50 border border-border rounded-xl p-4">
        <p className="text-xs text-text-tertiary leading-relaxed">
          MCP servers are defined in your vault's <code className="text-accent bg-surface-2 px-1 py-0.5 rounded">.mcp.json</code> file.
          Servers connect on demand when Claude needs their tools. Use "Reload" after editing the file.
        </p>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-surface-1 border border-border rounded-xl px-4 py-3">
      <p className={`text-2xl font-semibold ${color || 'text-text-primary'}`}>{value}</p>
      <p className="text-xs text-text-tertiary mt-0.5">{label}</p>
    </div>
  )
}

function ServerCard({ server, onConnect, onDisconnect }: {
  server: McpServerStatus; onConnect: () => void; onDisconnect: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const handleConnect = async () => {
    setConnecting(true)
    await onConnect()
    setConnecting(false)
  }

  return (
    <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setExpanded(!expanded)} className="p-0.5 text-text-tertiary hover:text-text-secondary">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <Circle className={`w-2.5 h-2.5 flex-shrink-0 ${server.connected ? 'text-success fill-success' : 'text-text-tertiary fill-text-tertiary/30'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">{server.name}</span>
            {server.connected && (
              <span className="text-[10px] px-1.5 py-0.5 bg-success/10 text-success rounded font-medium">connected</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Terminal className="w-3 h-3 text-text-tertiary flex-shrink-0" />
            <span className="text-xs text-text-tertiary font-mono truncate">{server.command} {server.args.join(' ')}</span>
          </div>
        </div>
        {server.connected && server.toolCount > 0 && (
          <div className="flex items-center gap-1 text-text-tertiary flex-shrink-0">
            <Wrench className="w-3 h-3" />
            <span className="text-xs">{server.toolCount}</span>
          </div>
        )}
        {server.connected ? (
          <button onClick={onDisconnect} className="p-1.5 text-text-tertiary hover:text-danger hover:bg-danger/10 rounded-lg transition-colors" title="Disconnect">
            <PowerOff className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleConnect} disabled={connecting} className="p-1.5 text-text-tertiary hover:text-success hover:bg-success/10 rounded-lg transition-colors disabled:opacity-50" title="Connect">
            <Power className={`w-4 h-4 ${connecting ? 'animate-pulse' : ''}`} />
          </button>
        )}
      </div>

      {expanded && server.connected && server.tools.length > 0 && (
        <div className="border-t border-border bg-surface-0/50">
          <div className="px-4 py-2">
            <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">Available Tools</span>
          </div>
          <div className="px-2 pb-2 space-y-0.5 max-h-64 overflow-y-auto">
            {server.tools.map(tool => (
              <div key={tool.name} className="px-3 py-2 rounded-lg hover:bg-surface-1 transition-colors">
                <span className="text-xs font-mono text-accent">{tool.name}</span>
                {tool.description && (
                  <p className="text-[11px] text-text-tertiary mt-0.5 leading-relaxed line-clamp-2">{tool.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {expanded && !server.connected && (
        <div className="border-t border-border px-4 py-3 bg-surface-0/50">
          <p className="text-xs text-text-tertiary">Connect to see available tools</p>
        </div>
      )}
    </div>
  )
}

/* ── Skills Tab ──────────────────────────────────────────────── */

function SkillsTab() {
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    window.dex.vault.getSkills().then(s => {
      setSkills(s)
      setLoading(false)
    })
  }, [])

  const filtered = search
    ? skills.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase()) ||
        s.command.toLowerCase().includes(search.toLowerCase())
      )
    : skills

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Skills</h1>
        <p className="text-sm text-text-tertiary mt-1">Browse available slash commands and workflows</p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-surface-1 border border-border rounded-lg px-3 py-2
        focus-within:border-accent/50 transition-colors">
        <Search className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search skills..."
          className="bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none flex-1"
        />
        {search && (
          <span className="text-xs text-text-tertiary">{filtered.length} found</span>
        )}
      </div>

      {/* Skills list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-surface-1 border border-border rounded-xl p-4 animate-pulse">
              <div className="h-4 w-24 bg-surface-2 rounded" />
              <div className="h-3 w-56 bg-surface-2 rounded mt-2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(skill => (
            <div key={skill.command} className="bg-surface-1 border border-border rounded-xl px-4 py-3 hover:bg-surface-1/80 transition-colors">
              <div className="flex items-center gap-2.5">
                <Zap className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                <span className="text-sm font-mono font-medium text-accent">{skill.command}</span>
              </div>
              {skill.description && (
                <p className="text-xs text-text-secondary mt-1.5 ml-6 leading-relaxed">{skill.description}</p>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="bg-surface-1 border border-border rounded-xl p-8 text-center">
              <Zap className="w-8 h-8 text-text-tertiary mx-auto mb-3" />
              <p className="text-sm text-text-tertiary">
                {search ? 'No skills match your search' : 'No skills found'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
