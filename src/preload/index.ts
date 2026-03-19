import { contextBridge, ipcRenderer } from 'electron'

export type DexAPI = {
  vault: {
    getTasks: () => Promise<VaultTasks>
    getProjects: () => Promise<VaultProject[]>
    getRecentMeetings: (limit?: number) => Promise<VaultMeeting[]>
    getPeople: () => Promise<VaultPerson[]>
    getConfig: () => Promise<VaultConfig>
    getFileTree: () => Promise<FileTreeNode[]>
    readFile: (path: string) => Promise<string>
    search: (query: string) => Promise<SearchResult[]>
    getSkills: () => Promise<SkillInfo[]>
    readSkill: (skillPath: string) => Promise<string>
    writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>
    appendToFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>
  }
  quickCapture: {
    hide: () => Promise<void>
  }
  chat: {
    sendMessage: (messages: ChatMessage[], skillContext?: string) => Promise<ChatResponse>
    getApiKeyStatus: () => Promise<boolean>
    setApiKey: (key: string) => Promise<void>
    onToolStep: (callback: (step: ToolStep) => void) => () => void
    onStreamStart: (callback: () => void) => () => void
    onTextDelta: (callback: (delta: string) => void) => () => void
  }
  conversations: {
    list: () => Promise<ConversationSummary[]>
    load: (id: string) => Promise<StoredConversation | null>
    save: (conv: StoredConversation) => Promise<void>
    delete: (id: string) => Promise<void>
  }
  agents: {
    list: () => Promise<AgentListItem[]>
    get: (id: string) => Promise<AgentDefinition | null>
    save: (agent: AgentDefinition) => Promise<void>
    delete: (id: string) => Promise<void>
    run: (agentId: string) => Promise<{ id: string } | null>
    cancel: (runId: string) => Promise<void>
    getRuns: (agentId: string, limit?: number) => Promise<AgentRun[]>
    getTemplates: () => Promise<AgentTemplate[]>
    onStatusChange: (callback: (data: AgentStatusEvent) => void) => () => void
    onStepUpdate: (callback: (data: AgentStepEvent) => void) => () => void
    onRunOutput: (callback: (data: AgentOutputEvent) => void) => () => void
  }
  activity: {
    getRecent: (limit?: number, category?: string) => Promise<ActivityEntry[]>
    getCategories: () => Promise<ActivityCategory[]>
    revert: (entryId: string) => Promise<{ success: boolean; error?: string }>
    onNew: (callback: (entry: ActivityEntry) => void) => () => void
  }
  mcp: {
    callTool: (server: string, tool: string, args: Record<string, unknown>) => Promise<unknown>
    getAvailableTools: () => Promise<McpToolInfo[]>
    getServerStatuses: () => Promise<McpServerStatus[]>
    connectServer: (name: string) => Promise<{ success: boolean; error?: string }>
    disconnectServer: (name: string) => Promise<void>
    reloadConfig: () => Promise<void>
  }
  briefing: {
    getWeekPriorities: () => Promise<WeekPriority[]>
    getMeetingBriefings: () => Promise<UpcomingMeetingBriefing[]>
    getAgentOvernight: () => Promise<AgentBriefingItem[]>
    getActivitySummary: () => Promise<ActivitySummary>
  }
  music: {
    available: () => Promise<boolean>
    nowPlaying: () => Promise<NowPlayingInfo | null>
    togglePlayPause: () => Promise<void>
    next: () => Promise<void>
    previous: () => Promise<void>
    setVolume: (level: number) => Promise<void>
    getVolume: () => Promise<number>
    search: (query: string) => Promise<MusicTrack[]>
    playSong: (song: string) => Promise<string>
    playlists: () => Promise<string[]>
    playPlaylist: (name: string) => Promise<void>
    libraryStats: () => Promise<{ totalTracks: number; totalPlaylists: number }>
  }
  system: {
    getVaultPath: () => Promise<string>
    setVaultPath: (path: string) => Promise<void>
    onVaultChange: (callback: (event: VaultChangeEvent) => void) => () => void
    openExternal: (url: string) => Promise<void>
    showOpenDialog: () => Promise<string | null>
    getPlatform: () => string
  }
}

export interface VaultTasks {
  pillars: {
    name: string
    tasks: { id: string; text: string; done: boolean; source?: string; priority?: string }[]
  }[]
}

export interface VaultProject {
  name: string
  path: string
  status?: string
  modified: number
}

export interface VaultMeeting {
  title: string
  date: string
  path: string
  attendees: string[]
  preview: string
}

export interface VaultPerson {
  name: string
  path: string
  role?: string
  company?: string
  internal: boolean
}

export interface VaultConfig {
  userName: string
  role: string
  pillars: { name: string; keywords: string[] }[]
  vaultPath: string
}

export interface FileTreeNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileTreeNode[]
}

export interface SearchResult {
  file: string
  line: number
  text: string
  context: string
}

export interface ToolStep {
  tool: string
  server: string
  args: Record<string, unknown>
  result: string
  durationMs: number
  status: 'running' | 'done' | 'error'
}

export interface ChatResponse {
  text: string
  toolSteps: ToolStep[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  toolSteps?: ToolStep[]
}

export interface SkillInfo {
  name: string
  command: string
  description: string
  skillPath: string
}

export interface McpToolInfo {
  server: string
  name: string
  description: string
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

export interface VaultChangeEvent {
  type: 'add' | 'change' | 'unlink'
  path: string
}

// -- Agent Types --

export interface AgentTrigger {
  type: 'manual' | 'schedule' | 'file_change'
  schedule?: string
  watchPaths?: string[]
}

export interface AgentDefinition {
  id: string
  name: string
  description: string
  icon: string
  systemPrompt: string
  trigger: AgentTrigger
  maxRounds: number
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface AgentRun {
  id: string
  agentId: string
  startedAt: number
  finishedAt?: number
  status: 'running' | 'completed' | 'error' | 'cancelled'
  steps: ToolStep[]
  output: string
  trigger: 'manual' | 'schedule' | 'file_change'
}

export interface AgentListItem {
  id: string
  name: string
  description: string
  icon: string
  trigger: AgentTrigger
  enabled: boolean
  lastRunAt?: number
  lastRunStatus?: string
  status: 'idle' | 'running' | 'queued' | 'error'
}

export interface AgentTemplate {
  id: string
  name: string
  description: string
  icon: string
  systemPrompt: string
  trigger: AgentTrigger
  maxRounds: number
}

export interface AgentStatusEvent {
  agentId: string
  runId: string
  status: string
  output?: string
}

export interface AgentStepEvent {
  agentId: string
  runId: string
  step: ToolStep
}

export interface AgentOutputEvent {
  agentId: string
  runId: string
  delta: string
}

export interface ActivityEntry {
  id: string
  timestamp: number
  type: 'created' | 'modified' | 'deleted'
  path: string
  label: string
  category: string
  summary?: string
  linesAdded?: string[]
  linesRemoved?: string[]
  changeCount?: number
  canRevert?: boolean
}

export interface ActivityCategory {
  id: string
  label: string
  count: number
}

// -- Briefing Types --

export interface WeekPriority {
  text: string
  done: boolean
}

export interface MeetingAttendeeContext {
  name: string
  role?: string
  company?: string
  lastMeetingDate?: string
  lastMeetingTopic?: string
  hasPersonPage: boolean
}

export interface UpcomingMeetingBriefing {
  title: string
  start: string
  end: string
  location?: string
  attendees: MeetingAttendeeContext[]
}

export interface AgentBriefingItem {
  agentName: string
  agentIcon: string
  runId: string
  completedAt: number
  outputPreview: string
  status: string
}

export interface ActivitySummary {
  created: number
  modified: number
  deleted: number
  categories: { name: string; count: number }[]
  highlights: string[]
}

export interface NowPlayingInfo {
  isPlaying: boolean
  track: string
  artist: string
  album: string
  duration: number
  position: number
}

export interface MusicTrack {
  name: string
  artist: string
}

export interface ConversationSummary {
  id: string
  title: string
  messageCount: number
  updatedAt: number
}

export interface StoredConversation {
  id: string
  title: string
  messages: ChatMessage[]
  activeSkill: string | null
  createdAt: number
  updatedAt: number
}

function ipcEvent<T>(channel: string, callback: (data: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, data: T) => callback(data)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: DexAPI = {
  vault: {
    getTasks: () => ipcRenderer.invoke('vault:getTasks'),
    getProjects: () => ipcRenderer.invoke('vault:getProjects'),
    getRecentMeetings: (limit = 5) => ipcRenderer.invoke('vault:getRecentMeetings', limit),
    getPeople: () => ipcRenderer.invoke('vault:getPeople'),
    getConfig: () => ipcRenderer.invoke('vault:getConfig'),
    getFileTree: () => ipcRenderer.invoke('vault:getFileTree'),
    readFile: (path: string) => ipcRenderer.invoke('vault:readFile', path),
    search: (query: string) => ipcRenderer.invoke('vault:search', query),
    getSkills: () => ipcRenderer.invoke('vault:getSkills'),
    readSkill: (skillPath: string) => ipcRenderer.invoke('vault:readSkill', skillPath),
    writeFile: (path: string, content: string) => ipcRenderer.invoke('vault:writeFile', path, content),
    appendToFile: (path: string, content: string) => ipcRenderer.invoke('vault:appendToFile', path, content)
  },
  quickCapture: {
    hide: () => ipcRenderer.invoke('quickCapture:hide')
  },
  chat: {
    sendMessage: (messages, skillContext?) => ipcRenderer.invoke('chat:sendMessage', messages, skillContext),
    getApiKeyStatus: () => ipcRenderer.invoke('chat:getApiKeyStatus'),
    setApiKey: (key) => ipcRenderer.invoke('chat:setApiKey', key),
    onToolStep: (callback) => ipcEvent<ToolStep>('chat:toolStep', callback),
    onStreamStart: (callback) => {
      const handler = () => callback()
      ipcRenderer.on('chat:streamStart', handler)
      return () => ipcRenderer.removeListener('chat:streamStart', handler)
    },
    onTextDelta: (callback) => ipcEvent<string>('chat:textDelta', callback)
  },
  conversations: {
    list: () => ipcRenderer.invoke('conversations:list'),
    load: (id) => ipcRenderer.invoke('conversations:load', id),
    save: (conv) => ipcRenderer.invoke('conversations:save', conv),
    delete: (id) => ipcRenderer.invoke('conversations:delete', id)
  },
  agents: {
    list: () => ipcRenderer.invoke('agents:list'),
    get: (id) => ipcRenderer.invoke('agents:get', id),
    save: (agent) => ipcRenderer.invoke('agents:save', agent),
    delete: (id) => ipcRenderer.invoke('agents:delete', id),
    run: (agentId) => ipcRenderer.invoke('agents:run', agentId),
    cancel: (runId) => ipcRenderer.invoke('agents:cancel', runId),
    getRuns: (agentId, limit) => ipcRenderer.invoke('agents:getRuns', agentId, limit),
    getTemplates: () => ipcRenderer.invoke('agents:getTemplates'),
    onStatusChange: (callback) => ipcEvent<AgentStatusEvent>('agents:statusChange', callback),
    onStepUpdate: (callback) => ipcEvent<AgentStepEvent>('agents:stepUpdate', callback),
    onRunOutput: (callback) => ipcEvent<AgentOutputEvent>('agents:runOutput', callback)
  },
  activity: {
    getRecent: (limit, category) => ipcRenderer.invoke('activity:getRecent', limit, category),
    getCategories: () => ipcRenderer.invoke('activity:getCategories'),
    revert: (entryId) => ipcRenderer.invoke('activity:revert', entryId),
    onNew: (callback) => ipcEvent<ActivityEntry>('activity:new', callback)
  },
  mcp: {
    callTool: (server, tool, args) => ipcRenderer.invoke('mcp:callTool', server, tool, args),
    getAvailableTools: () => ipcRenderer.invoke('mcp:getAvailableTools'),
    getServerStatuses: () => ipcRenderer.invoke('mcp:getServerStatuses'),
    connectServer: (name: string) => ipcRenderer.invoke('mcp:connectServer', name),
    disconnectServer: (name: string) => ipcRenderer.invoke('mcp:disconnectServer', name),
    reloadConfig: () => ipcRenderer.invoke('mcp:reloadConfig')
  },
  briefing: {
    getWeekPriorities: () => ipcRenderer.invoke('briefing:getWeekPriorities'),
    getMeetingBriefings: () => ipcRenderer.invoke('briefing:getMeetingBriefings'),
    getAgentOvernight: () => ipcRenderer.invoke('briefing:getAgentOvernight'),
    getActivitySummary: () => ipcRenderer.invoke('briefing:getActivitySummary')
  },
  music: {
    available: () => ipcRenderer.invoke('music:available'),
    nowPlaying: () => ipcRenderer.invoke('music:nowPlaying'),
    togglePlayPause: () => ipcRenderer.invoke('music:togglePlayPause'),
    next: () => ipcRenderer.invoke('music:next'),
    previous: () => ipcRenderer.invoke('music:previous'),
    setVolume: (level) => ipcRenderer.invoke('music:setVolume', level),
    getVolume: () => ipcRenderer.invoke('music:getVolume'),
    search: (query) => ipcRenderer.invoke('music:search', query),
    playSong: (song) => ipcRenderer.invoke('music:playSong', song),
    playlists: () => ipcRenderer.invoke('music:playlists'),
    playPlaylist: (name) => ipcRenderer.invoke('music:playPlaylist', name),
    libraryStats: () => ipcRenderer.invoke('music:libraryStats')
  },
  system: {
    getVaultPath: () => ipcRenderer.invoke('system:getVaultPath'),
    setVaultPath: (path) => ipcRenderer.invoke('system:setVaultPath', path),
    onVaultChange: (callback) => ipcEvent<VaultChangeEvent>('vault:changed', callback),
    openExternal: (url) => ipcRenderer.invoke('system:openExternal', url),
    showOpenDialog: () => ipcRenderer.invoke('system:showOpenDialog'),
    getPlatform: () => process.platform
  }
}

contextBridge.exposeInMainWorld('dex', api)
