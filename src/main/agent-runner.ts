import Anthropic from '@anthropic-ai/sdk'
import { BrowserWindow } from 'electron'
import { readFile, writeFile, appendFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import type { VaultReader } from './vault-reader'
import type { McpBridge } from './mcp-bridge'
import type { AgentDefinition, AgentRun } from './agent-store'
import type { ToolStep } from './claude-client'

const BUILTIN_TOOLS: Anthropic.Tool[] = [
  {
    name: 'dex_read_file',
    description: 'Read the full contents of a file from the Dex vault. Use relative paths from vault root.',
    input_schema: {
      type: 'object' as const,
      properties: { path: { type: 'string', description: 'Relative path from vault root.' } },
      required: ['path']
    }
  },
  {
    name: 'dex_search_vault',
    description: 'Full-text search across all markdown files in the Dex vault.',
    input_schema: {
      type: 'object' as const,
      properties: { query: { type: 'string', description: 'Search query.' } },
      required: ['query']
    }
  },
  {
    name: 'dex_write_file',
    description: 'Write (create or overwrite) a file in the Dex vault. Creates parent directories automatically.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Relative path from vault root.' },
        content: { type: 'string', description: 'Content to write.' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'dex_append_to_file',
    description: 'Append content to an existing file in the Dex vault.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Relative path from vault root.' },
        content: { type: 'string', description: 'Content to append.' }
      },
      required: ['path', 'content']
    }
  }
]

function emitToRenderer(channel: string, ...args: unknown[]) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args)
    }
  }
}

const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305' as const,
  name: 'web_search' as const,
  max_uses: 10
}

export class AgentRunner {
  private client: Anthropic
  private vaultReader: VaultReader
  private mcpBridge: McpBridge | null
  private abortControllers = new Map<string, AbortController>()
  private tools: Anthropic.Tool[] = []
  private toolServerMap = new Map<string, string>()

  constructor(apiKey: string, vaultReader: VaultReader, mcpBridge: McpBridge | null) {
    this.client = new Anthropic({ apiKey })
    this.vaultReader = vaultReader
    this.mcpBridge = mcpBridge
  }

  async discoverTools() {
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
    } catch { /* tools may not be available yet */ }
  }

  private getAllTools(): Anthropic.Messages.Tool[] {
    return [...this.tools, WEB_SEARCH_TOOL] as Anthropic.Messages.Tool[]
  }

  isRunning(runId: string): boolean {
    return this.abortControllers.has(runId)
  }

  cancel(runId: string) {
    const ctrl = this.abortControllers.get(runId)
    if (ctrl) {
      ctrl.abort()
      this.abortControllers.delete(runId)
    }
  }

  async run(agent: AgentDefinition, triggerType: 'manual' | 'schedule' | 'file_change', preRunId?: string): Promise<AgentRun> {
    const runId = preRunId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const abortCtrl = new AbortController()
    this.abortControllers.set(runId, abortCtrl)

    const run: AgentRun = {
      id: runId,
      agentId: agent.id,
      startedAt: Date.now(),
      status: 'running',
      steps: [],
      output: '',
      trigger: triggerType
    }

    emitToRenderer('agents:statusChange', { agentId: agent.id, runId, status: 'running' })

    try {
      await this.discoverTools()

      const config = await this.vaultReader.getConfig()
      const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      })

      const systemPrompt = `You are an autonomous agent working inside Dex, a personal knowledge system for ${config.userName}. Today is ${today}.

## Your Role

${agent.name}: ${agent.description}

## Instructions

${agent.systemPrompt}

## Important

- You are running autonomously in the background — the user is NOT actively chatting with you.
- Be thorough but efficient. Complete your task and report what you did.
- Use tools proactively to read files, search for information, and write updates.
- **NEVER claim to have done something without actually calling a tool.** Every file read, write, or update MUST be a real tool call. Do not hallucinate actions.
- Keep your final summary concise — the user will see it in their agent run log.
- Do NOT ask questions — make reasonable decisions and note any assumptions.`

      const apiMessages: Anthropic.MessageParam[] = [
        { role: 'user', content: `Run your task now. Trigger: ${triggerType}.` }
      ]

      let rounds = 0
      const maxRounds = agent.maxRounds || 30

      while (rounds < maxRounds) {
        if (abortCtrl.signal.aborted) {
          run.status = 'cancelled'
          break
        }

        rounds++

        const stream = this.client.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          tools: this.getAllTools(),
          messages: apiMessages
        })

        let textAccumulator = ''
        stream.on('text', (delta) => {
          textAccumulator += delta
          emitToRenderer('agents:runOutput', { agentId: agent.id, runId, delta })
        })

        const response = await stream.finalMessage()

        // Handle server-side web search — emit as a tool step for UI visibility
        for (const block of response.content) {
          if (block.type === 'server_tool_use' && block.name === 'web_search') {
            const query = (block.input as Record<string, unknown>)?.query as string || ''
            const step: ToolStep = {
              tool: 'web_search', server: 'anthropic', args: { query },
              result: 'Search executed by Claude', durationMs: 0, status: 'done'
            }
            run.steps.push(step)
            emitToRenderer('agents:stepUpdate', { agentId: agent.id, runId, step })
          }
        }

        // If Claude paused a long turn (e.g. mid-search), send it back to continue
        if (response.stop_reason === 'pause_turn') {
          apiMessages.push({ role: 'assistant', content: response.content })
          continue
        }

        const hasToolUse = response.content.some(b => b.type === 'tool_use')

        if (response.stop_reason === 'end_turn' || !hasToolUse) {
          const textBlocks = response.content.filter(
            (b): b is Anthropic.TextBlock => b.type === 'text'
          )
          run.output = textBlocks.map(b => b.text).join('\n\n') || textAccumulator || 'Agent completed with no output.'
          if (run.status === 'running') run.status = 'completed'
          break
        }

        apiMessages.push({ role: 'assistant', content: response.content })
        const toolResults: Anthropic.ToolResultBlockParam[] = []

        for (const block of response.content) {
          if (block.type === 'tool_use') {
            if (abortCtrl.signal.aborted) break

            const args = block.input as Record<string, unknown>
            const server = block.name.startsWith('dex_') ? 'vault' : (this.toolServerMap.get(block.name) || 'unknown')

            const step: ToolStep = { tool: block.name, server, args, result: '', durationMs: 0, status: 'running' }
            emitToRenderer('agents:stepUpdate', { agentId: agent.id, runId, step })

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
            const truncated = result.length > 500 ? result.slice(0, 500) + `... (${result.length} chars)` : result

            const completedStep = { ...step, result: truncated, durationMs, status }
            run.steps.push(completedStep)
            emitToRenderer('agents:stepUpdate', { agentId: agent.id, runId, step: completedStep })

            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
          }
        }

        apiMessages.push({ role: 'user', content: toolResults })
      }

      if (rounds >= maxRounds && run.status === 'running') {
        run.output += '\n\n(Reached maximum tool rounds)'
        run.status = 'completed'
      }
    } catch (error) {
      run.status = 'error'
      run.output = error instanceof Error ? error.message : 'Unknown error'
    } finally {
      run.finishedAt = Date.now()
      this.abortControllers.delete(runId)
      emitToRenderer('agents:statusChange', {
        agentId: agent.id,
        runId,
        status: run.status,
        output: run.output
      })
    }

    return run
  }

  private async executeTool(name: string, input: Record<string, unknown>): Promise<string> {
    if (name === 'dex_read_file') {
      try {
        return await this.vaultReader.readFile(input.path as string)
      } catch (e) {
        return JSON.stringify({ error: e instanceof Error ? e.message : 'Read failed' })
      }
    }

    if (name === 'dex_search_vault') {
      const results = await this.vaultReader.search(input.query as string)
      return JSON.stringify(results, null, 2)
    }

    if (name === 'dex_write_file') {
      try {
        const config = await this.vaultReader.getConfig()
        const fullPath = join(config.vaultPath, input.path as string)
        if (!fullPath.startsWith(config.vaultPath)) return '{"error": "Path traversal not allowed"}'
        await mkdir(dirname(fullPath), { recursive: true })
        await writeFile(fullPath, input.content as string, 'utf-8')
        return JSON.stringify({ success: true, path: input.path })
      } catch (e) {
        return JSON.stringify({ error: e instanceof Error ? e.message : 'Write failed' })
      }
    }

    if (name === 'dex_append_to_file') {
      try {
        const config = await this.vaultReader.getConfig()
        const fullPath = join(config.vaultPath, input.path as string)
        if (!fullPath.startsWith(config.vaultPath)) return '{"error": "Path traversal not allowed"}'
        await appendFile(fullPath, input.content as string, 'utf-8')
        return JSON.stringify({ success: true, path: input.path })
      } catch (e) {
        return JSON.stringify({ error: e instanceof Error ? e.message : 'Append failed' })
      }
    }

    const server = this.toolServerMap.get(name)
    if (server && this.mcpBridge) {
      return await this.mcpBridge.callTool(server, name, input)
    }

    return JSON.stringify({ error: `Unknown tool: ${name}` })
  }
}
