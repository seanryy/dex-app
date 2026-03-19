import { readFile, readdir, stat } from 'fs/promises'
import { join, basename, relative, extname } from 'path'
import { watch } from 'chokidar'
import { BrowserWindow } from 'electron'
import yaml from 'js-yaml'
import matter from 'gray-matter'
import type { ActivityStore } from './activity-store'

export interface TaskItem {
  id: string
  text: string
  done: boolean
  source?: string
  priority?: string
}

export interface PillarTasks {
  name: string
  tasks: TaskItem[]
}

export interface VaultTasks {
  pillars: PillarTasks[]
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

export interface PillarConfig {
  name: string
  keywords: string[]
}

export interface VaultConfig {
  userName: string
  role: string
  pillars: PillarConfig[]
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

const IGNORED_DIRS = new Set(['.git', '.obsidian', 'node_modules', '.scripts', '.claude', 'core', 'System', '.cursor'])

export interface SkillInfo {
  name: string
  command: string
  description: string
  skillPath: string
}

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

export interface ActivitySummary {
  created: number
  modified: number
  deleted: number
  categories: { name: string; count: number }[]
  highlights: string[]
}

export class VaultReader {
  private vaultPath: string
  private watcher: ReturnType<typeof watch> | null = null
  private activityDebounce = new Map<string, ReturnType<typeof setTimeout>>()
  activityStore: ActivityStore | null = null

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath
  }

  setVaultPath(path: string) {
    this.vaultPath = path
    this.stopWatching()
  }

  // --- Tasks ---

  async getTasks(): Promise<VaultTasks> {
    const tasksPath = join(this.vaultPath, '03-Tasks', 'Tasks.md')
    let content: string
    try {
      content = await readFile(tasksPath, 'utf-8')
    } catch {
      return { pillars: [] }
    }

    const pillars: PillarTasks[] = []
    let currentPillar: PillarTasks | null = null
    const lines = content.split('\n')

    for (const line of lines) {
      const pillarMatch = line.match(/^## (.+)/)
      if (pillarMatch) {
        const name = pillarMatch[1].trim()
        if (name === 'Completed') break
        currentPillar = { name, tasks: [] }
        pillars.push(currentPillar)
        continue
      }

      if (!currentPillar) continue

      const taskMatch = line.match(/^- \[([ x])\] (.+)/)
      if (taskMatch) {
        const done = taskMatch[1] === 'x'
        let text = taskMatch[2]

        const idMatch = text.match(/\[\[?\^(task-\d{8}-\d{3})\]?\]?/)
        const id = idMatch ? idMatch[1] : ''

        const sourceMatch = text.match(/\*\(from: \[([^\]]+)\]/)
        const source = sourceMatch ? sourceMatch[1] : undefined

        text = text
          .replace(/\[\[?\^task-\d{8}-\d{3}\]?\]?/g, '')
          .replace(/\*\(from:.*\)\*/g, '')
          .trim()

        currentPillar.tasks.push({ id, text, done, source })
      }
    }

    return { pillars }
  }

  // --- Projects ---

  async getProjects(): Promise<VaultProject[]> {
    const projectsDir = join(this.vaultPath, '04-Projects')
    const projects: VaultProject[] = []

    try {
      const entries = await readdir(projectsDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        const fullPath = join(projectsDir, entry.name)

        if (entry.isDirectory()) {
          const indexPath = join(fullPath, `${entry.name}.md`)
          try {
            const s = await stat(indexPath)
            const content = await readFile(indexPath, 'utf-8')
            const statusMatch = content.match(/(?:status|Status):\s*(.+)/i)
            projects.push({
              name: entry.name.replace(/_/g, ' '),
              path: relative(this.vaultPath, indexPath),
              status: statusMatch?.[1]?.trim(),
              modified: s.mtimeMs
            })
          } catch {
            projects.push({
              name: entry.name.replace(/_/g, ' '),
              path: relative(this.vaultPath, fullPath),
              modified: 0
            })
          }
        } else if (entry.name.endsWith('.md')) {
          const s = await stat(fullPath)
          const content = await readFile(fullPath, 'utf-8')
          const statusMatch = content.match(/(?:status|Status):\s*(.+)/i)
          projects.push({
            name: entry.name.replace('.md', '').replace(/_/g, ' '),
            path: relative(this.vaultPath, fullPath),
            status: statusMatch?.[1]?.trim(),
            modified: s.mtimeMs
          })
        }
      }
    } catch { /* folder may not exist */ }

    return projects.sort((a, b) => b.modified - a.modified)
  }

  // --- Meetings ---

  async getRecentMeetings(limit = 5): Promise<VaultMeeting[]> {
    const meetingsDir = join(this.vaultPath, '00-Inbox', 'Meetings')
    const meetings: VaultMeeting[] = []

    try {
      const entries = await readdir(meetingsDir)
      const mdFiles = entries.filter(f => f.endsWith('.md')).sort().reverse()

      for (const file of mdFiles.slice(0, limit)) {
        const fullPath = join(meetingsDir, file)
        const content = await readFile(fullPath, 'utf-8')

        const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/)
        const date = dateMatch ? dateMatch[1] : ''
        const title = file
          .replace(/^\d{4}-\d{2}-\d{2}\s*-?\s*/, '')
          .replace('.md', '')

        const attendees: string[] = []
        const attendeeMatch = content.match(/(?:attendees|participants|with):\s*(.+)/i)
        if (attendeeMatch) {
          attendees.push(...attendeeMatch[1].split(',').map(a => a.trim()))
        }

        const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('---'))
        const preview = lines.slice(0, 3).join(' ').slice(0, 200)

        meetings.push({
          title,
          date,
          path: relative(this.vaultPath, fullPath),
          attendees,
          preview
        })
      }
    } catch { /* folder may not exist */ }

    return meetings
  }

  // --- People ---

  async getPeople(): Promise<VaultPerson[]> {
    const peopleDir = join(this.vaultPath, '05-Areas', 'People')
    const people: VaultPerson[] = []

    for (const subDir of ['Internal', 'External']) {
      const dir = join(peopleDir, subDir)
      const internal = subDir === 'Internal'
      try {
        const entries = await readdir(dir)
        for (const file of entries) {
          if (!file.endsWith('.md')) continue
          const fullPath = join(dir, file)
          const content = await readFile(fullPath, 'utf-8')

          const name = file.replace('.md', '').replace(/_/g, ' ')
          const roleMatch = content.match(/(?:role|title|position):\s*(.+)/i)
          const companyMatch = content.match(/(?:company|org|organization):\s*(.+)/i)

          people.push({
            name,
            path: relative(this.vaultPath, fullPath),
            role: roleMatch?.[1]?.trim(),
            company: companyMatch?.[1]?.trim(),
            internal
          })
        }
      } catch { /* dir may not exist */ }
    }

    return people.sort((a, b) => a.name.localeCompare(b.name))
  }

  // --- Config ---

  async getConfig(): Promise<VaultConfig> {
    const pillars: PillarConfig[] = []

    try {
      const pillarsContent = await readFile(join(this.vaultPath, 'System', 'pillars.yaml'), 'utf-8')
      const parsed = yaml.load(pillarsContent) as { pillars?: { name: string; keywords: string[] }[] }
      if (parsed?.pillars) {
        for (const p of parsed.pillars) {
          pillars.push({ name: p.name, keywords: p.keywords || [] })
        }
      }
    } catch { /* missing config */ }

    let userName = 'User'
    let role = ''
    try {
      const profileContent = await readFile(join(this.vaultPath, 'System', 'user-profile.yaml'), 'utf-8')
      const profile = yaml.load(profileContent) as { name?: string; role?: string }
      userName = profile?.name || 'User'
      role = profile?.role || ''
    } catch { /* missing profile */ }

    return { userName, role, pillars, vaultPath: this.vaultPath }
  }

  // --- Skills (slash commands) ---

  async getSkills(): Promise<SkillInfo[]> {
    const skillsDir = join(this.vaultPath, '.claude', 'skills')
    const skills: SkillInfo[] = []

    try {
      const entries = await readdir(skillsDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (entry.name.startsWith('_') || entry.name.startsWith('anthropic-')) continue

        const skillFile = join(skillsDir, entry.name, 'SKILL.md')
        try {
          const content = await readFile(skillFile, 'utf-8')
          const parsed = matter(content)
          const name = (parsed.data.name as string) || entry.name
          const description = (parsed.data.description as string) || ''

          skills.push({
            name,
            command: `/${entry.name}`,
            description,
            skillPath: `.claude/skills/${entry.name}/SKILL.md`
          })
        } catch { /* no SKILL.md */ }
      }
    } catch { /* skills dir doesn't exist */ }

    return skills.sort((a, b) => a.command.localeCompare(b.command))
  }

  async readSkill(skillPath: string): Promise<string> {
    const fullPath = join(this.vaultPath, skillPath)
    if (!fullPath.startsWith(this.vaultPath)) {
      throw new Error('Path traversal not allowed')
    }
    return readFile(fullPath, 'utf-8')
  }

  // --- File Tree ---

  async getFileTree(dir?: string, depth = 0): Promise<FileTreeNode[]> {
    const targetDir = dir || this.vaultPath
    if (depth > 3) return []

    const nodes: FileTreeNode[] = []
    try {
      const entries = await readdir(targetDir, { withFileTypes: true })
      const sorted = entries
        .filter(e => !e.name.startsWith('.'))
        .sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1
          if (!a.isDirectory() && b.isDirectory()) return 1
          return a.name.localeCompare(b.name)
        })

      for (const entry of sorted) {
        const fullPath = join(targetDir, entry.name)
        const relPath = relative(this.vaultPath, fullPath)

        if (entry.isDirectory()) {
          if (IGNORED_DIRS.has(entry.name)) continue
          const children = await this.getFileTree(fullPath, depth + 1)
          nodes.push({ name: entry.name, path: relPath, isDirectory: true, children })
        } else {
          if (!entry.name.endsWith('.md') && !entry.name.endsWith('.yaml')) continue
          nodes.push({ name: entry.name, path: relPath, isDirectory: false })
        }
      }
    } catch { /* permission denied, etc */ }

    return nodes
  }

  // --- Read File ---

  async readFile(relativePath: string): Promise<string> {
    const fullPath = join(this.vaultPath, relativePath)
    if (!fullPath.startsWith(this.vaultPath)) {
      throw new Error('Path traversal not allowed')
    }
    return readFile(fullPath, 'utf-8')
  }

  // --- Search ---

  async search(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = []
    const lowerQuery = query.toLowerCase()

    const walkDir = async (dir: string) => {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        const fullPath = join(dir, entry.name)

        if (entry.isDirectory()) {
          if (IGNORED_DIRS.has(entry.name)) continue
          await walkDir(fullPath)
        } else if (entry.name.endsWith('.md')) {
          try {
            const content = await readFile(fullPath, 'utf-8')
            const lines = content.split('\n')
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].toLowerCase().includes(lowerQuery)) {
                const contextStart = Math.max(0, i - 1)
                const contextEnd = Math.min(lines.length - 1, i + 1)
                results.push({
                  file: relative(this.vaultPath, fullPath),
                  line: i + 1,
                  text: lines[i].trim(),
                  context: lines.slice(contextStart, contextEnd + 1).join('\n')
                })
                if (results.length >= 50) return
              }
            }
          } catch { /* skip unreadable files */ }
        }
      }
    }

    try {
      await walkDir(this.vaultPath)
    } catch { /* walk error */ }

    return results
  }

  // --- Week Priorities ---

  async getWeekPriorities(): Promise<WeekPriority[]> {
    const filePath = join(this.vaultPath, '02-Week_Priorities', 'Week_Priorities.md')
    let content: string
    try {
      content = await readFile(filePath, 'utf-8')
    } catch {
      return []
    }

    const priorities: WeekPriority[] = []
    for (const line of content.split('\n')) {
      const match = line.match(/^- \[([ x])\] (.+)/)
      if (match) {
        priorities.push({
          text: match[2].trim(),
          done: match[1] === 'x'
        })
      }
    }
    return priorities
  }

  // --- Meeting Enrichment ---

  async enrichMeetingsWithContext(
    events: { title: string; start: string; end: string; location?: string; attendees?: string[] }[]
  ): Promise<UpcomingMeetingBriefing[]> {
    const people = await this.getPeople()
    const meetings = await this.getRecentMeetings(30)

    const fuzzyMatch = (attendee: string, personName: string): boolean => {
      const a = attendee.toLowerCase().replace(/[_\-.]/g, ' ').trim()
      const p = personName.toLowerCase().replace(/[_\-.]/g, ' ').trim()
      if (a === p) return true
      if (p.includes(a) || a.includes(p)) return true
      const aParts = a.split(/\s+/)
      const pParts = p.split(/\s+/)
      if (aParts.length > 1 && pParts.length > 1) {
        return aParts[aParts.length - 1] === pParts[pParts.length - 1] && aParts[0][0] === pParts[0][0]
      }
      return false
    }

    const findLastMeeting = (name: string): { date: string; topic: string } | null => {
      const lower = name.toLowerCase()
      for (const m of meetings) {
        if (m.title.toLowerCase().includes(lower)) return { date: m.date, topic: m.title }
        if (m.attendees.some(a => a.toLowerCase().includes(lower))) return { date: m.date, topic: m.title }
      }
      return null
    }

    return events.map(event => {
      const attendeeContexts: MeetingAttendeeContext[] = (event.attendees || []).map(attendeeName => {
        const matched = people.find(p => fuzzyMatch(attendeeName, p.name))
        const lastMeeting = findLastMeeting(attendeeName)
        return {
          name: attendeeName,
          role: matched?.role,
          company: matched?.company,
          lastMeetingDate: lastMeeting?.date,
          lastMeetingTopic: lastMeeting?.topic,
          hasPersonPage: !!matched
        }
      })

      return {
        title: event.title,
        start: event.start,
        end: event.end,
        location: event.location,
        attendees: attendeeContexts
      }
    })
  }

  // --- Activity Summary ---

  async getRecentActivitySummary(hours = 24): Promise<ActivitySummary> {
    if (!this.activityStore) {
      return { created: 0, modified: 0, deleted: 0, categories: [], highlights: [] }
    }

    const entries = this.activityStore.getRecent(200)
    const cutoff = Date.now() - hours * 60 * 60 * 1000
    const recent = entries.filter(e => e.timestamp > cutoff)

    let created = 0
    let modified = 0
    let deleted = 0
    const catCounts = new Map<string, number>()
    const highlights: string[] = []

    for (const entry of recent) {
      if (entry.type === 'created') created++
      else if (entry.type === 'modified') modified++
      else if (entry.type === 'deleted') deleted++

      catCounts.set(entry.category, (catCounts.get(entry.category) || 0) + 1)

      if (highlights.length < 5 && entry.summary) {
        highlights.push(`${entry.label}: ${entry.summary}`)
      }
    }

    const categories = Array.from(catCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    return { created, modified, deleted, categories, highlights }
  }

  // --- Watching ---

  startWatching() {
    if (this.watcher) return
    this.watcher = watch(this.vaultPath, {
      ignored: /(^|[\/\\])(\.|node_modules|\.git|\.obsidian|core|\.scripts)/,
      persistent: true,
      ignoreInitial: true,
      depth: 4
    })

    this.watcher.on('all', async (eventType, filePath) => {
      const relPath = relative(this.vaultPath, filePath)
      const type = eventType === 'add' ? 'add' : eventType === 'unlink' ? 'unlink' : 'change'

      if (this.activityStore && relPath.endsWith('.md')) {
        try {
          if (eventType === 'add') {
            const content = await readFile(filePath, 'utf-8')
            const entry = this.activityStore.recordCreated(relPath, content)
            if (entry) this.emitActivity(entry)
          } else if (eventType === 'change') {
            // Debounce: wait 2s for rapid successive writes to settle
            const existing = this.activityDebounce.get(relPath)
            if (existing) clearTimeout(existing)
            this.activityDebounce.set(relPath, setTimeout(async () => {
              this.activityDebounce.delete(relPath)
              try {
                const content = await readFile(filePath, 'utf-8')
                const entry = this.activityStore?.recordModified(relPath, content)
                if (entry) this.emitActivity(entry)
              } catch { /* file may be gone */ }
            }, 2000))
          } else if (eventType === 'unlink') {
            // Cancel any pending debounce for this file
            const pending = this.activityDebounce.get(relPath)
            if (pending) { clearTimeout(pending); this.activityDebounce.delete(relPath) }
            const entry = this.activityStore.recordDeleted(relPath)
            if (entry) this.emitActivity(entry)
          }
        } catch { /* file may be gone */ }
      }

      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('vault:changed', { type, path: relPath })
        }
      }
    })
  }

  private emitActivity(entry: unknown) {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('activity:new', entry)
      }
    }
  }

  /** Pre-cache file contents for diff computation on first change */
  async warmActivityCache() {
    if (!this.activityStore) return
    const walkDir = async (dir: string) => {
      try {
        const entries = await readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue
          const fullPath = join(dir, entry.name)
          if (entry.isDirectory()) {
            if (IGNORED_DIRS.has(entry.name)) continue
            await walkDir(fullPath)
          } else if (entry.name.endsWith('.md')) {
            try {
              const content = await readFile(fullPath, 'utf-8')
              this.activityStore!.cacheContent(relative(this.vaultPath, fullPath), content)
            } catch { /* skip */ }
          }
        }
      } catch { /* skip */ }
    }
    await walkDir(this.vaultPath)
  }

  stopWatching() {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  }
}
