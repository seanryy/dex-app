import { readFile, writeFile, mkdir, readdir, unlink } from 'fs/promises'
import { join } from 'path'

export interface StoredConversation {
  id: string
  title: string
  messages: { role: string; content: string; toolSteps?: unknown[] }[]
  activeSkill: string | null
  createdAt: number
  updatedAt: number
}

export interface ConversationSummary {
  id: string
  title: string
  messageCount: number
  updatedAt: number
}

export class ConversationStore {
  private dir: string

  constructor(configDir: string) {
    this.dir = join(configDir, 'conversations')
  }

  private async ensureDir() {
    await mkdir(this.dir, { recursive: true })
  }

  async list(): Promise<ConversationSummary[]> {
    await this.ensureDir()
    try {
      const files = await readdir(this.dir)
      const summaries: ConversationSummary[] = []

      for (const file of files) {
        if (!file.endsWith('.json')) continue
        try {
          const raw = await readFile(join(this.dir, file), 'utf-8')
          const conv = JSON.parse(raw) as StoredConversation
          summaries.push({
            id: conv.id,
            title: conv.title,
            messageCount: conv.messages.length,
            updatedAt: conv.updatedAt
          })
        } catch { /* skip corrupt files */ }
      }

      return summaries.sort((a, b) => b.updatedAt - a.updatedAt)
    } catch {
      return []
    }
  }

  async load(id: string): Promise<StoredConversation | null> {
    try {
      const raw = await readFile(join(this.dir, `${id}.json`), 'utf-8')
      return JSON.parse(raw) as StoredConversation
    } catch {
      return null
    }
  }

  async save(conv: StoredConversation): Promise<void> {
    await this.ensureDir()
    await writeFile(
      join(this.dir, `${conv.id}.json`),
      JSON.stringify(conv, null, 2),
      'utf-8'
    )
  }

  async delete(id: string): Promise<void> {
    try {
      await unlink(join(this.dir, `${id}.json`))
    } catch { /* ignore */ }
  }
}
