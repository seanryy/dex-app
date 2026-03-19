import { useState, useEffect, useCallback } from 'react'
import {
  Plug,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Circle,
  Wrench,
  Power,
  PowerOff,
  Terminal
} from 'lucide-react'
import type { McpServerStatus } from '../../../preload/index'

export function McpManagerView() {
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
    if (result.success) {
      await loadStatuses()
    }
  }

  const handleDisconnect = async (name: string) => {
    await window.dex.mcp.disconnectServer(name)
    await loadStatuses()
  }

  const connectedCount = servers.filter(s => s.connected).length
  const totalTools = servers.reduce((sum, s) => sum + s.toolCount, 0)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text-primary flex items-center gap-2.5">
              <Plug className="w-5 h-5 text-accent" />
              MCP Servers
            </h1>
            <p className="text-sm text-text-tertiary mt-1">
              Manage the Model Context Protocol servers that power Dex
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary bg-surface-1
              border border-border rounded-lg hover:bg-surface-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Reload config
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Configured" value={servers.length} />
          <StatCard label="Connected" value={connectedCount} color={connectedCount > 0 ? 'text-success' : undefined} />
          <StatCard label="Tools Available" value={totalTools} color={totalTools > 0 ? 'text-accent' : undefined} />
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
          <div className="space-y-3">
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

        {/* Info */}
        <div className="bg-surface-1/50 border border-border rounded-xl p-4">
          <p className="text-xs text-text-tertiary leading-relaxed">
            MCP servers are defined in your vault's <code className="text-accent bg-surface-2 px-1 py-0.5 rounded">.mcp.json</code> file
            — the same config Cursor uses. Servers connect on demand when Claude needs their tools.
            Use "Reload config" after editing the file.
          </p>
        </div>
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

function ServerCard({
  server,
  onConnect,
  onDisconnect
}: {
  server: McpServerStatus
  onConnect: () => void
  onDisconnect: () => void
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
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-0.5 text-text-tertiary hover:text-text-secondary transition-colors"
        >
          {expanded
            ? <ChevronDown className="w-4 h-4" />
            : <ChevronRight className="w-4 h-4" />
          }
        </button>

        {/* Status dot */}
        <Circle
          className={`w-2.5 h-2.5 flex-shrink-0 ${
            server.connected ? 'text-success fill-success' : 'text-text-tertiary fill-text-tertiary/30'
          }`}
        />

        {/* Name & info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">{server.name}</span>
            {server.connected && (
              <span className="text-[10px] px-1.5 py-0.5 bg-success/10 text-success rounded font-medium">
                connected
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Terminal className="w-3 h-3 text-text-tertiary flex-shrink-0" />
            <span className="text-xs text-text-tertiary font-mono truncate">
              {server.command} {server.args.join(' ')}
            </span>
          </div>
        </div>

        {/* Tool count */}
        {server.connected && server.toolCount > 0 && (
          <div className="flex items-center gap-1 text-text-tertiary flex-shrink-0">
            <Wrench className="w-3 h-3" />
            <span className="text-xs">{server.toolCount}</span>
          </div>
        )}

        {/* Connect / Disconnect */}
        {server.connected ? (
          <button
            onClick={onDisconnect}
            className="p-1.5 text-text-tertiary hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
            title="Disconnect"
          >
            <PowerOff className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="p-1.5 text-text-tertiary hover:text-success hover:bg-success/10 rounded-lg transition-colors disabled:opacity-50"
            title="Connect"
          >
            <Power className={`w-4 h-4 ${connecting ? 'animate-pulse' : ''}`} />
          </button>
        )}
      </div>

      {/* Expanded: tools list */}
      {expanded && server.connected && server.tools.length > 0 && (
        <div className="border-t border-border bg-surface-0/50">
          <div className="px-4 py-2">
            <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">
              Available Tools
            </span>
          </div>
          <div className="px-2 pb-2 space-y-0.5 max-h-64 overflow-y-auto">
            {server.tools.map(tool => (
              <div key={tool.name} className="px-3 py-2 rounded-lg hover:bg-surface-1 transition-colors">
                <span className="text-xs font-mono text-accent">{tool.name}</span>
                {tool.description && (
                  <p className="text-[11px] text-text-tertiary mt-0.5 leading-relaxed line-clamp-2">
                    {tool.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {expanded && !server.connected && (
        <div className="border-t border-border px-4 py-3 bg-surface-0/50">
          <p className="text-xs text-text-tertiary">
            Connect to see available tools
          </p>
        </div>
      )}
    </div>
  )
}
