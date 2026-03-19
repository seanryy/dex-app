import Anthropic from '@anthropic-ai/sdk'
import { BrowserWindow } from 'electron'
import type { VaultReader } from './vault-reader'
import type { McpBridge } from './mcp-bridge'
import { readFile, writeFile, appendFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'

interface VaultContext {
  userName: string
  role: string
  pillars: { name: string; keywords: string[] }[]
  vaultPath: string
}

async function readOptionalFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return null
  }
}

export interface ToolStep {
  tool: string
  server: string
  args: Record<string, unknown>
  result: string
  durationMs: number
  status: 'running' | 'done' | 'error'
}

const BUILTIN_TOOLS: Anthropic.Tool[] = [
  {
    name: 'dex_read_file',
    description: 'Read the full contents of a file from the Dex vault. Use relative paths from vault root (e.g. "03-Tasks/Tasks.md", "05-Areas/People/Internal/Sean_Ryan.md").',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Relative path to the file from the vault root.' }
      },
      required: ['path']
    }
  },
  {
    name: 'dex_search_vault',
    description: 'Full-text search across all markdown files in the Dex vault. Returns matching lines with file path and context.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query string.' }
      },
      required: ['query']
    }
  },
  {
    name: 'dex_write_file',
    description: 'Write (create or overwrite) a file in the Dex vault. Use relative paths from vault root. Creates parent directories automatically.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Relative path to the file from the vault root.' },
        content: { type: 'string', description: 'The full content to write to the file.' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'dex_append_to_file',
    description: 'Append content to an existing file in the Dex vault. Useful for adding tasks, notes, or sections to existing files.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Relative path to the file from the vault root.' },
        content: { type: 'string', description: 'Content to append to the end of the file.' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'music_play_pause',
    description: 'Toggle play/pause on Apple Music. Use when the user asks to play, pause, or resume music.',
    input_schema: { type: 'object' as const, properties: {} }
  },
  {
    name: 'music_next_track',
    description: 'Skip to the next track in Apple Music.',
    input_schema: { type: 'object' as const, properties: {} }
  },
  {
    name: 'music_previous_track',
    description: 'Go back to the previous track in Apple Music.',
    input_schema: { type: 'object' as const, properties: {} }
  },
  {
    name: 'music_now_playing',
    description: 'Get info about the currently playing track (name, artist, album, position).',
    input_schema: { type: 'object' as const, properties: {} }
  },
  {
    name: 'music_search',
    description: 'Search the user\'s Apple Music library for tracks matching a query. Returns track names and artists.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query (song name, artist, etc.)' }
      },
      required: ['query']
    }
  },
  {
    name: 'music_play_song',
    description: 'Play a specific song by exact name from the user\'s Apple Music library.',
    input_schema: {
      type: 'object' as const,
      properties: {
        song: { type: 'string', description: 'Exact name of the song to play.' }
      },
      required: ['song']
    }
  },
  {
    name: 'music_play_playlist',
    description: 'Play a playlist by name from the user\'s Apple Music library.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Name of the playlist to play.' }
      },
      required: ['name']
    }
  },
  {
    name: 'music_set_volume',
    description: 'Set Apple Music volume (0-100).',
    input_schema: {
      type: 'object' as const,
      properties: {
        level: { type: 'number', description: 'Volume level from 0 to 100.' }
      },
      required: ['level']
    }
  },
  {
    name: 'music_get_playlists',
    description: 'List all user playlists in Apple Music.',
    input_schema: { type: 'object' as const, properties: {} }
  }
]

const MAX_TOOL_ROUNDS = 20

const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305' as const,
  name: 'web_search' as const,
  max_uses: 5
}

function emitToRenderer(channel: string, ...args: unknown[]) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, ...args)
  }
}

function emitToolStep(step: ToolStep) {
  emitToRenderer('chat:toolStep', step)
}

function emitStreamStart() {
  emitToRenderer('chat:streamStart')
}

function emitTextDelta(delta: string) {
  emitToRenderer('chat:textDelta', delta)
}

export class ClaudeClient {
  private client: Anthropic
  private systemPrompt: string
  private tools: Anthropic.Tool[] = []
  private toolServerMap: Map<string, string> = new Map()
  vaultReader: VaultReader | null = null
  mcpBridge: McpBridge | null = null

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
    this.systemPrompt = 'You are Dex, a personal knowledge assistant.'
  }

  async setVaultContext(context: VaultContext) {
    const vp = context.vaultPath

    const [claudeMd, userProfile, pillarsYaml, identityModel, tasksFile, weekPriorities] =
      await Promise.all([
        readOptionalFile(join(vp, 'CLAUDE.md')),
        readOptionalFile(join(vp, 'System/user-profile.yaml')),
        readOptionalFile(join(vp, 'System/pillars.yaml')),
        readOptionalFile(join(vp, 'System/identity-model.md')),
        readOptionalFile(join(vp, '03-Tasks/Tasks.md')),
        readOptionalFile(join(vp, '02-Week_Priorities/Week_Priorities.md'))
      ])

    const today = new Date()
    const dateStr = today.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })

    // Extract communication prefs from user profile
    const commPrefs = extractCommPrefs(userProfile)

    // Primary identity — this is the voice Claude leads with
    const identity = `You are Dex, a personal knowledge assistant for ${context.userName}. Today is ${dateStr}.

You're friendly, sharp, and genuinely helpful — like a trusted colleague who knows everything about ${context.userName}'s work. You chat naturally, not like a document generator.

## How you talk

- **Be conversational.** Short sentences. Natural flow. Like a smart coworker in Slack, not a consultant writing a memo.
- **Keep responses tight.** 2-4 sentences for simple questions. Bullets only when listing real items, not as a default structure.
- **Don't over-format.** Skip headers, horizontal rules, and bold labels unless the user asks for something structured. Just talk.
- **No preamble.** Don't start with "Great question!" or "I'd be happy to help!" — just answer.
- **Match the user's energy.** Quick question gets a quick answer. Deep question gets a thoughtful one. Don't inflate simple things.
- **Use contractions.** "You've got" not "You have". "It's" not "It is". "Don't" not "Do not".
${commPrefs}

## What you can do

You have full access to ${context.userName}'s Dex vault and tools — the same MCP tools as in Cursor, plus vault file reading and search. Use them proactively. Never say you don't have access to something — you do, just call the tool.

When you use tools, be natural about it. Don't announce "Let me search your vault" — just do it and share what you found.

## CRITICAL: Always use tools for actions

**NEVER claim to have done something without actually calling a tool.** If the user asks you to save, update, create, or change anything, you MUST call the appropriate tool (dex_write_file, dex_append_to_file, etc.) in your response. Do NOT say "Done! I've saved it" or "Added!" unless you have actually made a tool call in that same response. If you're unsure whether a file exists, read it first with dex_read_file. Saying you did something without calling the tool is the worst thing you can do — it erodes trust.`

    // Background reference — Claude can draw on this but shouldn't mirror its structure
    const refSections: string[] = []

    if (claudeMd) {
      refSections.push(`<workspace_rules>
${claudeMd}
</workspace_rules>`)
    }

    if (userProfile) {
      refSections.push(`<user_profile>
${userProfile}
</user_profile>`)
    }

    if (pillarsYaml) {
      refSections.push(`<pillars>
${pillarsYaml}
</pillars>`)
    }

    if (identityModel) {
      refSections.push(`<identity_model>
${identityModel}
</identity_model>`)
    }

    if (weekPriorities) {
      refSections.push(`<week_priorities>
${weekPriorities}
</week_priorities>`)
    }

    if (tasksFile) {
      const taskPreview = tasksFile.length > 3000
        ? tasksFile.slice(0, 3000) + '\n\n(truncated — use dex_read_file for full list)'
        : tasksFile
      refSections.push(`<active_tasks>
${taskPreview}
</active_tasks>`)
    }

    let reference = ''
    if (refSections.length > 0) {
      reference = `

<reference_context>
The following is background knowledge about the user, their vault, and system rules. Draw on it naturally when relevant — but do NOT mirror its structure or formality in your responses. This is reference material, not a template.

${refSections.join('\n\n')}
</reference_context>`
    }

    this.systemPrompt = identity + reference

    await this.discoverTools()
  }

  private async discoverTools() {
    this.tools = [...BUILTIN_TOOLS]
    this.toolServerMap.clear()

    if (!this.mcpBridge) return

    try {
      const mcpTools = await this.mcpBridge.discoverAllTools()

      for (const tool of mcpTools) {
        this.toolServerMap.set(tool.name, tool.server)
        this.tools.push({
          name: tool.name,
          description: `[${tool.server}] ${tool.description}`,
          input_schema: tool.inputSchema as Anthropic.Tool.InputSchema
        })
      }

      console.log(`Discovered ${mcpTools.length} MCP tools from ${new Set(mcpTools.map(t => t.server)).size} servers`)
    } catch (err) {
      console.warn('Failed to discover MCP tools:', err)
    }
  }

  private getServerForTool(name: string): string {
    if (name.startsWith('dex_')) return 'vault'
    return this.toolServerMap.get(name) || 'unknown'
  }

  private async executeTool(name: string, input: Record<string, unknown>): Promise<string> {
    if (name === 'dex_read_file') {
      if (!this.vaultReader) return '{"error": "Vault not loaded"}'
      try {
        return await this.vaultReader.readFile(input.path as string)
      } catch (e) {
        return JSON.stringify({ error: e instanceof Error ? e.message : 'Read failed' })
      }
    }

    if (name === 'dex_search_vault') {
      if (!this.vaultReader) return '{"error": "Vault not loaded"}'
      const results = await this.vaultReader.search(input.query as string)
      return JSON.stringify(results, null, 2)
    }

    if (name === 'dex_write_file') {
      if (!this.vaultReader) return '{"error": "Vault not loaded"}'
      try {
        const config = await this.vaultReader.getConfig()
        const fullPath = join(config.vaultPath, input.path as string)
        if (!fullPath.startsWith(config.vaultPath)) {
          return '{"error": "Path traversal not allowed"}'
        }
        await mkdir(dirname(fullPath), { recursive: true })
        await writeFile(fullPath, input.content as string, 'utf-8')
        return JSON.stringify({ success: true, path: input.path })
      } catch (e) {
        return JSON.stringify({ error: e instanceof Error ? e.message : 'Write failed' })
      }
    }

    if (name === 'dex_append_to_file') {
      if (!this.vaultReader) return '{"error": "Vault not loaded"}'
      try {
        const config = await this.vaultReader.getConfig()
        const fullPath = join(config.vaultPath, input.path as string)
        if (!fullPath.startsWith(config.vaultPath)) {
          return '{"error": "Path traversal not allowed"}'
        }
        await appendFile(fullPath, input.content as string, 'utf-8')
        return JSON.stringify({ success: true, path: input.path })
      } catch (e) {
        return JSON.stringify({ error: e instanceof Error ? e.message : 'Append failed' })
      }
    }

    if (name.startsWith('music_')) {
      return await this.executeMusicTool(name, input)
    }

    const server = this.toolServerMap.get(name)
    if (server && this.mcpBridge) {
      return await this.mcpBridge.callTool(server, name, input)
    }

    return JSON.stringify({ error: `Unknown tool: ${name}` })
  }

  private async executeMusicTool(name: string, input: Record<string, unknown>): Promise<string> {
    try {
      const music = await import('./music-service')
      switch (name) {
        case 'music_play_pause':
          await music.togglePlayPause()
          return JSON.stringify(await music.getNowPlaying())
        case 'music_next_track':
          await music.nextTrack()
          return JSON.stringify(await music.getNowPlaying())
        case 'music_previous_track':
          await music.previousTrack()
          return JSON.stringify(await music.getNowPlaying())
        case 'music_now_playing':
          return JSON.stringify(await music.getNowPlaying())
        case 'music_search':
          return JSON.stringify(await music.searchLibrary(input.query as string))
        case 'music_play_song':
          return await music.playSong(input.song as string)
        case 'music_play_playlist':
          await music.playPlaylist(input.name as string)
          return JSON.stringify({ success: true, playlist: input.name })
        case 'music_set_volume':
          await music.setVolume(input.level as number)
          return JSON.stringify({ success: true, volume: input.level })
        case 'music_get_playlists':
          return JSON.stringify(await music.getPlaylists())
        default:
          return JSON.stringify({ error: `Unknown music tool: ${name}` })
      }
    } catch (e) {
      return JSON.stringify({ error: e instanceof Error ? e.message : 'Music command failed' })
    }
  }

  async chat(
    messages: { role: string; content: string }[],
    skillContext?: string
  ): Promise<{ text: string; toolSteps: ToolStep[] }> {
    const allToolSteps: ToolStep[] = []

    try {
      const apiMessages: Anthropic.MessageParam[] = messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))

      const systemPrompt = skillContext
        ? `${this.systemPrompt}\n\n---\n\n## Active Skill\n\nThe user invoked a slash command. Follow the instructions in this skill definition:\n\n${skillContext}`
        : this.systemPrompt

      let rounds = 0

      while (rounds < MAX_TOOL_ROUNDS) {
        rounds++

        emitStreamStart()

        const allTools = [...this.tools, WEB_SEARCH_TOOL] as Anthropic.Messages.Tool[]

        const stream = this.client.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          tools: allTools,
          messages: apiMessages
        })

        stream.on('text', (delta) => {
          emitTextDelta(delta)
        })

        const response = await stream.finalMessage()

        // Emit web search steps for UI visibility
        for (const block of response.content) {
          if (block.type === 'server_tool_use' && block.name === 'web_search') {
            const query = (block.input as Record<string, unknown>)?.query as string || ''
            const step: ToolStep = {
              tool: 'web_search', server: 'anthropic', args: { query },
              result: 'Search executed by Claude', durationMs: 0, status: 'done'
            }
            allToolSteps.push(step)
            emitToolStep(step)
          }
        }

        // If Claude paused mid-turn (e.g. during search), send it back to continue
        if (response.stop_reason === 'pause_turn') {
          apiMessages.push({ role: 'assistant', content: response.content })
          continue
        }

        const hasToolUse = response.content.some(b => b.type === 'tool_use')

        if (response.stop_reason === 'end_turn' || !hasToolUse) {
          const textBlocks = response.content.filter(
            (b): b is Anthropic.TextBlock => b.type === 'text'
          )
          return {
            text: textBlocks.map(b => b.text).join('\n\n') || 'No response generated.',
            toolSteps: allToolSteps
          }
        }

        apiMessages.push({ role: 'assistant', content: response.content })

        const toolResults: Anthropic.ToolResultBlockParam[] = []

        for (const block of response.content) {
          if (block.type === 'tool_use') {
            const args = block.input as Record<string, unknown>
            const server = this.getServerForTool(block.name)

            emitToolStep({
              tool: block.name,
              server,
              args,
              result: '',
              durationMs: 0,
              status: 'running'
            })

            const start = Date.now()
            let result: string
            let status: 'done' | 'error' = 'done'

            try {
              result = await this.executeTool(block.name, args)
            } catch (e) {
              result = JSON.stringify({ error: e instanceof Error ? e.message : 'Failed' })
              status = 'error'
            }

            const durationMs = Date.now() - start

            const truncatedResult = result.length > 500
              ? result.slice(0, 500) + `... (${result.length} chars)`
              : result

            const step: ToolStep = {
              tool: block.name,
              server,
              args,
              result: truncatedResult,
              durationMs,
              status
            }

            allToolSteps.push(step)
            emitToolStep(step)

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result
            })
          }
        }

        apiMessages.push({ role: 'user', content: toolResults })
      }

      return {
        text: 'Reached maximum tool rounds. Please try a more specific question.',
        toolSteps: allToolSteps
      }
    } catch (error) {
      let text: string
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('authentication')) {
          text = 'Invalid API key. Please update it in Settings.'
        } else {
          text = `Error: ${error.message}`
        }
      } else {
        text = 'An unexpected error occurred.'
      }
      return { text, toolSteps: allToolSteps }
    }
  }
}

function extractCommPrefs(userProfile: string | null): string {
  if (!userProfile) return ''

  const lines: string[] = []

  if (userProfile.includes('formality: "casual"')) {
    lines.push('- **Tone:** Casual — like texting a work friend.')
  } else if (userProfile.includes('formality: "formal"')) {
    lines.push('- **Tone:** Professional but not stiff.')
  }

  if (userProfile.includes('directness: "very_direct"')) {
    lines.push('- **Be blunt.** Skip hedging and caveats — say what you think.')
  } else if (userProfile.includes('directness: "supportive"')) {
    lines.push('- **Be encouraging.** Frame feedback constructively.')
  }

  if (userProfile.includes('detail_level: "comprehensive"')) {
    lines.push('- **Go deeper** when explaining — the user prefers thorough answers.')
  }

  return lines.length > 0 ? '\n' + lines.join('\n') : ''
}
