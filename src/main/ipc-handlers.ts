import { ipcMain, dialog, shell, safeStorage } from 'electron'
import { readFile, writeFile, mkdir, appendFile } from 'fs/promises'
import { join, dirname } from 'path'
import { app } from 'electron'
import { VaultReader } from './vault-reader'
import { ClaudeClient } from './claude-client'
import { McpBridge } from './mcp-bridge'
import { ConversationStore, type StoredConversation } from './conversation-store'
import { AgentEngine } from './agent-engine'
import { AGENT_TEMPLATES } from './agent-templates'
import { ActivityStore } from './activity-store'
import type { AgentDefinition } from './agent-store'

let vaultReader: VaultReader | null = null
let activityStore: ActivityStore | null = null
let claudeClient: ClaudeClient | null = null
let mcpBridge: McpBridge | null = null
let conversationStore: ConversationStore | null = null
let agentEngine: AgentEngine | null = null

function getConfigDir() {
  return join(app.getPath('userData'), 'config')
}

function getVaultPathFile() {
  return join(getConfigDir(), 'vault-path.txt')
}

function getApiKeyFile() {
  const canEncrypt = safeStorage.isEncryptionAvailable()
  return join(getConfigDir(), canEncrypt ? 'api-key.enc' : 'api-key.txt')
}

async function ensureConfigDir() {
  await mkdir(getConfigDir(), { recursive: true })
}

async function saveApiKey(key: string): Promise<void> {
  await ensureConfigDir()
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(key)
    await writeFile(join(getConfigDir(), 'api-key.enc'), encrypted)
  } else {
    console.warn('safeStorage not available — storing API key as plain text (dev mode)')
    await writeFile(join(getConfigDir(), 'api-key.txt'), key, 'utf-8')
  }
}

async function loadApiKey(): Promise<string | null> {
  try {
    await ensureConfigDir()
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = await readFile(join(getConfigDir(), 'api-key.enc'))
      return safeStorage.decryptString(encrypted)
    } else {
      const key = await readFile(join(getConfigDir(), 'api-key.txt'), 'utf-8')
      return key.trim() || null
    }
  } catch {
    return null
  }
}

async function loadVaultPath(): Promise<string | null> {
  try {
    const path = await readFile(getVaultPathFile(), 'utf-8')
    return path.trim() || null
  } catch {
    return null
  }
}

async function ensureClaudeClient(): Promise<ClaudeClient | null> {
  if (claudeClient) return claudeClient

  const key = await loadApiKey()
  if (!key) return null

  claudeClient = new ClaudeClient(key)
  claudeClient.vaultReader = vaultReader
  claudeClient.mcpBridge = mcpBridge

  if (vaultReader) {
    const config = await vaultReader.getConfig()
    await claudeClient.setVaultContext(config)
  }

  return claudeClient
}

async function initVault(path: string) {
  vaultReader = new VaultReader(path)

  activityStore = new ActivityStore(getConfigDir())
  activityStore.setVaultPath(path)
  await activityStore.load()
  vaultReader.activityStore = activityStore

  vaultReader.startWatching()

  // Pre-cache file contents for diff computation (background, non-blocking)
  vaultReader.warmActivityCache()

  mcpBridge = new McpBridge(path)
  await mcpBridge.loadConfigFromVault()

  await ensureClaudeClient()

  agentEngine = new AgentEngine(getConfigDir(), vaultReader, mcpBridge, path)
  const apiKey = await loadApiKey()
  if (apiKey) {
    agentEngine.setApiKey(apiKey)
  }
  agentEngine.start()
}

export function registerIpcHandlers() {
  conversationStore = new ConversationStore(getConfigDir())

  // -- System --

  ipcMain.handle('system:getVaultPath', async () => {
    await ensureConfigDir()
    const path = await loadVaultPath()
    if (path && !vaultReader) {
      await initVault(path)
    }
    return path
  })

  ipcMain.handle('system:setVaultPath', async (_event, path: string) => {
    await ensureConfigDir()
    await writeFile(getVaultPathFile(), path, 'utf-8')
    await initVault(path)
  })

  ipcMain.handle('system:openExternal', async (_event, url: string) => {
    await shell.openExternal(url)
  })

  ipcMain.handle('system:showOpenDialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select your Dex vault folder'
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // -- Vault --

  ipcMain.handle('vault:getTasks', async () => {
    if (!vaultReader) return { pillars: [] }
    return vaultReader.getTasks()
  })

  ipcMain.handle('vault:getProjects', async () => {
    if (!vaultReader) return []
    return vaultReader.getProjects()
  })

  ipcMain.handle('vault:getRecentMeetings', async (_event, limit: number) => {
    if (!vaultReader) return []
    return vaultReader.getRecentMeetings(limit)
  })

  ipcMain.handle('vault:getPeople', async () => {
    if (!vaultReader) return []
    return vaultReader.getPeople()
  })

  ipcMain.handle('vault:getConfig', async () => {
    if (!vaultReader) return null
    return vaultReader.getConfig()
  })

  ipcMain.handle('vault:getFileTree', async () => {
    if (!vaultReader) return []
    return vaultReader.getFileTree()
  })

  ipcMain.handle('vault:readFile', async (_event, path: string) => {
    if (!vaultReader) return ''
    return vaultReader.readFile(path)
  })

  ipcMain.handle('vault:search', async (_event, query: string) => {
    if (!vaultReader) return []
    return vaultReader.search(query)
  })

  ipcMain.handle('vault:getSkills', async () => {
    if (!vaultReader) return []
    return vaultReader.getSkills()
  })

  ipcMain.handle('vault:readSkill', async (_event, skillPath: string) => {
    if (!vaultReader) return ''
    return vaultReader.readSkill(skillPath)
  })

  ipcMain.handle('vault:writeFile', async (_event, relativePath: string, content: string) => {
    if (!vaultReader) return { success: false, error: 'No vault loaded' }
    try {
      const config = await vaultReader.getConfig()
      const fullPath = join(config.vaultPath, relativePath)
      if (!fullPath.startsWith(config.vaultPath)) {
        return { success: false, error: 'Path traversal not allowed' }
      }
      await mkdir(dirname(fullPath), { recursive: true })
      await writeFile(fullPath, content, 'utf-8')
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Write failed' }
    }
  })

  ipcMain.handle('vault:appendToFile', async (_event, relativePath: string, content: string) => {
    if (!vaultReader) return { success: false, error: 'No vault loaded' }
    try {
      const config = await vaultReader.getConfig()
      const fullPath = join(config.vaultPath, relativePath)
      if (!fullPath.startsWith(config.vaultPath)) {
        return { success: false, error: 'Path traversal not allowed' }
      }
      await appendFile(fullPath, content, 'utf-8')
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Append failed' }
    }
  })

  // -- Quick Capture --

  ipcMain.handle('quickCapture:hide', () => {
    const { BrowserWindow } = require('electron')
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.getTitle() === 'Quick Capture') {
        win.hide()
        break
      }
    }
  })

  // -- Chat --

  ipcMain.handle('chat:getApiKeyStatus', async () => {
    const key = await loadApiKey()
    return !!key
  })

  ipcMain.handle('chat:setApiKey', async (_event, key: string) => {
    await saveApiKey(key)

    claudeClient = new ClaudeClient(key)
    claudeClient.vaultReader = vaultReader
    claudeClient.mcpBridge = mcpBridge
    if (vaultReader) {
      const config = await vaultReader.getConfig()
      await claudeClient.setVaultContext(config)
    }
  })

  ipcMain.handle('chat:sendMessage', async (_event, messages: { role: string; content: string }[], skillContext?: string) => {
    const client = await ensureClaudeClient()
    if (!client) {
      return { text: 'Please set your Claude API key in Settings first.', toolSteps: [] }
    }
    return client.chat(messages, skillContext)
  })

  // -- MCP --

  ipcMain.handle('mcp:callTool', async (_event, server: string, tool: string, args: Record<string, unknown>) => {
    if (!mcpBridge) return { error: 'No vault loaded' }
    return mcpBridge.callTool(server, tool, args)
  })

  ipcMain.handle('mcp:getAvailableTools', async () => {
    if (!mcpBridge) return []
    return mcpBridge.discoverAllTools()
  })

  ipcMain.handle('mcp:getServerStatuses', async () => {
    if (!mcpBridge) return []
    return mcpBridge.getServerStatuses()
  })

  ipcMain.handle('mcp:connectServer', async (_event, name: string) => {
    if (!mcpBridge) return { success: false, error: 'No vault loaded' }
    return mcpBridge.connectServerByName(name)
  })

  ipcMain.handle('mcp:disconnectServer', async (_event, name: string) => {
    if (!mcpBridge) return
    await mcpBridge.disconnectServer(name)
  })

  ipcMain.handle('mcp:reloadConfig', async () => {
    if (!mcpBridge) return
    await mcpBridge.loadConfigFromVault()
  })

  // -- Conversations --

  ipcMain.handle('conversations:list', async () => {
    if (!conversationStore) return []
    return conversationStore.list()
  })

  ipcMain.handle('conversations:load', async (_event, id: string) => {
    if (!conversationStore) return null
    return conversationStore.load(id)
  })

  ipcMain.handle('conversations:save', async (_event, conv: StoredConversation) => {
    if (!conversationStore) return
    await conversationStore.save(conv)
  })

  ipcMain.handle('conversations:delete', async (_event, id: string) => {
    if (!conversationStore) return
    await conversationStore.delete(id)
  })

  // -- Agents --

  ipcMain.handle('agents:list', async () => {
    if (!agentEngine) return []
    const store = agentEngine.getStore()
    const summaries = await store.list()
    return summaries.map(s => ({
      ...s,
      status: agentEngine!.getStatus(s.id)
    }))
  })

  ipcMain.handle('agents:get', async (_event, id: string) => {
    if (!agentEngine) return null
    return agentEngine.getStore().get(id)
  })

  ipcMain.handle('agents:save', async (_event, agent: AgentDefinition) => {
    if (!agentEngine) return
    await agentEngine.getStore().save(agent)
  })

  ipcMain.handle('agents:delete', async (_event, id: string) => {
    if (!agentEngine) return
    await agentEngine.getStore().delete(id)
  })

  ipcMain.handle('agents:run', async (_event, agentId: string) => {
    if (!agentEngine) return null
    const runId = await agentEngine.startAgent(agentId, 'manual')
    return runId ? { id: runId } : null
  })

  ipcMain.handle('agents:cancel', async (_event, runId: string) => {
    if (!agentEngine) return
    agentEngine.cancelAgent(runId)
  })

  ipcMain.handle('agents:getRuns', async (_event, agentId: string, limit?: number) => {
    if (!agentEngine) return []
    return agentEngine.getStore().listRuns(agentId, limit || 10)
  })

  ipcMain.handle('agents:getTemplates', () => {
    return AGENT_TEMPLATES
  })

  // -- Briefing --

  ipcMain.handle('briefing:getWeekPriorities', async () => {
    if (!vaultReader) return []
    try { return await vaultReader.getWeekPriorities() } catch { return [] }
  })

  ipcMain.handle('briefing:getMeetingBriefings', async () => {
    if (!vaultReader) return []
    try {
      let events: { title: string; start: string; end: string; location?: string; attendees?: string[] }[] = []
      if (mcpBridge) {
        try {
          const result = await mcpBridge.callTool('calendar', 'calendar_get_today', {})
          if (result) {
            const parsed = JSON.parse(result)
            if (parsed.success && Array.isArray(parsed.events)) {
              events = parsed.events
            } else if (Array.isArray(parsed)) {
              events = parsed
            }
          }
        } catch { /* calendar not available */ }
      }
      return await vaultReader.enrichMeetingsWithContext(events)
    } catch { return [] }
  })

  ipcMain.handle('briefing:getAgentOvernight', async () => {
    if (!agentEngine) return []
    try {
      const store = agentEngine.getStore()
      const agents = await store.list()
      const overnight: { agentName: string; agentIcon: string; runId: string; completedAt: number; outputPreview: string; status: string }[] = []
      const cutoff = Date.now() - 24 * 60 * 60 * 1000
      for (const agent of agents) {
        const runs = await store.listRuns(agent.id, 3)
        for (const run of runs) {
          if (run.finishedAt && run.finishedAt > cutoff && run.status === 'completed') {
            overnight.push({
              agentName: agent.name,
              agentIcon: agent.icon,
              runId: run.id,
              completedAt: run.finishedAt,
              outputPreview: run.output?.slice(0, 300) || '',
              status: run.status
            })
          }
        }
      }
      return overnight.sort((a, b) => b.completedAt - a.completedAt)
    } catch { return [] }
  })

  ipcMain.handle('briefing:getActivitySummary', async () => {
    if (!vaultReader) return { created: 0, modified: 0, deleted: 0, categories: [], highlights: [] }
    try {
      return await vaultReader.getRecentActivitySummary(24)
    } catch {
      return { created: 0, modified: 0, deleted: 0, categories: [], highlights: [] }
    }
  })

  // -- Activity --

  ipcMain.handle('activity:getRecent', async (_event, limit?: number, category?: string) => {
    if (!activityStore) return []
    return activityStore.getRecent(limit || 50, category)
  })

  ipcMain.handle('activity:getCategories', async () => {
    if (!activityStore) return []
    return activityStore.getCategories()
  })

  ipcMain.handle('activity:revert', async (_event, entryId: string) => {
    if (!activityStore) return { success: false, error: 'Activity store not initialized' }
    return activityStore.revert(entryId)
  })

  // -- Apple Music --

  ipcMain.handle('music:available', async () => {
    const { isAppleMusicAvailable } = await import('./music-service')
    return isAppleMusicAvailable()
  })

  ipcMain.handle('music:nowPlaying', async () => {
    const { getNowPlaying } = await import('./music-service')
    try { return await getNowPlaying() } catch { return null }
  })

  ipcMain.handle('music:togglePlayPause', async () => {
    const { togglePlayPause } = await import('./music-service')
    return togglePlayPause()
  })

  ipcMain.handle('music:next', async () => {
    const { nextTrack } = await import('./music-service')
    return nextTrack()
  })

  ipcMain.handle('music:previous', async () => {
    const { previousTrack } = await import('./music-service')
    return previousTrack()
  })

  ipcMain.handle('music:setVolume', async (_event, level: number) => {
    const { setVolume } = await import('./music-service')
    return setVolume(level)
  })

  ipcMain.handle('music:getVolume', async () => {
    const { getVolume } = await import('./music-service')
    return getVolume()
  })

  ipcMain.handle('music:search', async (_event, query: string) => {
    const { searchLibrary } = await import('./music-service')
    return searchLibrary(query)
  })

  ipcMain.handle('music:playSong', async (_event, song: string) => {
    const { playSong } = await import('./music-service')
    return playSong(song)
  })

  ipcMain.handle('music:playlists', async () => {
    const { getPlaylists } = await import('./music-service')
    return getPlaylists()
  })

  ipcMain.handle('music:playPlaylist', async (_event, name: string) => {
    const { playPlaylist } = await import('./music-service')
    return playPlaylist(name)
  })

  ipcMain.handle('music:libraryStats', async () => {
    const { getLibraryStats } = await import('./music-service')
    return getLibraryStats()
  })
}
