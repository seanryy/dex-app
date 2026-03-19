import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { readFile } from 'fs/promises'
import { join } from 'path'

interface McpJsonServerConfig {
  command: string
  args?: string[]
  cwd?: string
  env?: Record<string, string>
}

interface McpJsonFile {
  mcpServers: Record<string, McpJsonServerConfig>
}

export interface McpToolDefinition {
  server: string
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface McpServerStatus {
  name: string
  command: string
  args: string[]
  connected: boolean
  toolCount: number
  tools: { name: string; description: string }[]
  error?: string
}

export class McpBridge {
  private vaultPath: string
  private clients: Map<string, Client> = new Map()
  private transports: Map<string, StdioClientTransport> = new Map()
  private serverConfigs: Record<string, McpJsonServerConfig> = {}
  private toolCache: McpToolDefinition[] | null = null

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath
  }

  async loadConfigFromVault(): Promise<void> {
    try {
      const raw = await readFile(join(this.vaultPath, '.mcp.json'), 'utf-8')
      const parsed: McpJsonFile = JSON.parse(raw)
      this.serverConfigs = parsed.mcpServers || {}
      this.toolCache = null
    } catch {
      console.warn('No .mcp.json found in vault, MCP tools will be limited')
    }
  }

  private async connectServer(name: string): Promise<Client | null> {
    if (this.clients.has(name)) return this.clients.get(name)!

    const config = this.serverConfigs[name]
    if (!config) return null

    try {
      const env: Record<string, string> = {
        ...process.env as Record<string, string>,
        ...(config.env || {})
      }

      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args || [],
        env,
        cwd: config.cwd || this.vaultPath
      })

      const client = new Client({
        name: `dex-app-${name}`,
        version: '0.1.0'
      })

      await client.connect(transport)
      this.clients.set(name, client)
      this.transports.set(name, transport)
      return client
    } catch (error) {
      console.error(`Failed to connect MCP server '${name}':`, error)
      return null
    }
  }

  async discoverAllTools(): Promise<McpToolDefinition[]> {
    if (this.toolCache) return this.toolCache

    if (Object.keys(this.serverConfigs).length === 0) {
      await this.loadConfigFromVault()
    }

    const tools: McpToolDefinition[] = []

    for (const serverName of Object.keys(this.serverConfigs)) {
      const client = await this.connectServer(serverName)
      if (!client) continue

      try {
        const result = await client.listTools()
        for (const tool of result.tools) {
          tools.push({
            server: serverName,
            name: tool.name,
            description: tool.description || '',
            inputSchema: (tool.inputSchema as Record<string, unknown>) || { type: 'object', properties: {} }
          })
        }
      } catch (err) {
        console.warn(`Could not list tools for MCP server '${serverName}':`, err)
      }
    }

    this.toolCache = tools
    return tools
  }

  async callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<string> {
    const client = await this.connectServer(serverName)
    if (!client) {
      return JSON.stringify({ error: `MCP server '${serverName}' not available` })
    }

    try {
      const result = await client.callTool({ name: toolName, arguments: args })

      if (result.content && Array.isArray(result.content)) {
        return result.content
          .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
          .map(b => b.text)
          .join('\n')
      }

      return JSON.stringify(result)
    } catch (error) {
      return JSON.stringify({ error: error instanceof Error ? error.message : 'MCP call failed' })
    }
  }

  findServerForTool(toolName: string): string | null {
    if (!this.toolCache) return null
    const entry = this.toolCache.find(t => t.name === toolName)
    return entry?.server || null
  }

  getServerConfigs(): Record<string, McpJsonServerConfig> {
    return { ...this.serverConfigs }
  }

  async getServerStatuses(): Promise<McpServerStatus[]> {
    if (Object.keys(this.serverConfigs).length === 0) {
      await this.loadConfigFromVault()
    }

    const statuses: McpServerStatus[] = []

    for (const [name, config] of Object.entries(this.serverConfigs)) {
      const isConnected = this.clients.has(name)
      const tools: { name: string; description: string }[] = []

      if (isConnected) {
        const client = this.clients.get(name)!
        try {
          const result = await client.listTools()
          for (const t of result.tools) {
            tools.push({ name: t.name, description: t.description || '' })
          }
        } catch { /* ignore */ }
      }

      statuses.push({
        name,
        command: config.command,
        args: config.args || [],
        connected: isConnected,
        toolCount: tools.length,
        tools
      })
    }

    return statuses
  }

  async connectServerByName(name: string): Promise<{ success: boolean; error?: string }> {
    const client = await this.connectServer(name)
    if (client) {
      this.toolCache = null
      return { success: true }
    }
    return { success: false, error: `Failed to connect to '${name}'` }
  }

  async disconnectServer(name: string): Promise<void> {
    const transport = this.transports.get(name)
    if (transport) {
      try { await transport.close() } catch { /* ignore */ }
      this.transports.delete(name)
    }
    this.clients.delete(name)
    this.toolCache = null
  }

  async shutdown() {
    for (const [, transport] of this.transports) {
      try { await transport.close() } catch { /* ignore */ }
    }
    this.clients.clear()
    this.transports.clear()
    this.toolCache = null
  }
}
