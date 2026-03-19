import { readFile, writeFile, mkdir, unlink, access } from 'fs/promises'
import { join, dirname } from 'path'

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
  /** Whether this entry can be reverted */
  canRevert?: boolean
}

const MAX_ENTRIES = 200
const CATEGORY_MAP: [RegExp, string][] = [
  [/^05-Areas\/People\//, 'person'],
  [/^05-Areas\/Companies\//, 'company'],
  [/^05-Areas\/Competitors\//, 'competitor'],
  [/^05-Areas\/Career\//, 'career'],
  [/^00-Inbox\/Meetings\//, 'meeting'],
  [/^00-Inbox\/Ideas\//, 'idea'],
  [/^04-Projects\//, 'project'],
  [/^03-Tasks\//, 'task'],
  [/^01-Quarter_Goals\//, 'goal'],
  [/^02-Week_Priorities\//, 'priority'],
  [/^06-Resources\//, 'resource'],
]

function categorize(path: string): string {
  for (const [pattern, cat] of CATEGORY_MAP) {
    if (pattern.test(path)) return cat
  }
  return 'note'
}

function friendlyLabel(path: string): string {
  const filename = path.split('/').pop() || path
  return filename
    .replace(/\.md$/, '')
    .replace(/^\d{2}-/, '')
    .replace(/_/g, ' ')
    .replace(/^\d{4}-\d{2}-\d{2}\s*-?\s*/, (match) => {
      const d = new Date(match.trim().replace(/ -$/, ''))
      return isNaN(d.getTime()) ? match : ''
    })
    .trim()
}

function computeDiff(oldContent: string, newContent: string): { added: string[]; removed: string[]; summary: string } {
  if (oldContent === newContent) return { added: [], removed: [], summary: '' }

  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')

  // Fast path: content was appended (common case for dex_append_to_file)
  if (newContent.startsWith(oldContent) || newLines.length > oldLines.length && newLines.slice(0, oldLines.length).join('\n') === oldLines.join('\n')) {
    const appended = newLines.slice(oldLines.length).filter(l => l.trim())
    if (appended.length > 0) {
      return {
        added: appended.slice(0, 20),
        removed: [],
        summary: formatSummary(appended.length, 0, appended)
      }
    }
  }

  // General case: sequential diff using LCS-style forward scan
  const added: string[] = []
  const removed: string[] = []
  let oi = 0, ni = 0

  while (oi < oldLines.length && ni < newLines.length) {
    if (oldLines[oi] === newLines[ni]) {
      oi++
      ni++
    } else {
      // Look ahead in new lines for the current old line
      let foundInNew = -1
      for (let j = ni + 1; j < Math.min(ni + 10, newLines.length); j++) {
        if (oldLines[oi] === newLines[j]) { foundInNew = j; break }
      }
      // Look ahead in old lines for the current new line
      let foundInOld = -1
      for (let j = oi + 1; j < Math.min(oi + 10, oldLines.length); j++) {
        if (newLines[ni] === oldLines[j]) { foundInOld = j; break }
      }

      if (foundInNew >= 0 && (foundInOld < 0 || foundInNew - ni <= foundInOld - oi)) {
        // Lines were inserted in new
        while (ni < foundInNew) {
          if (newLines[ni].trim()) added.push(newLines[ni])
          ni++
        }
      } else if (foundInOld >= 0) {
        // Lines were removed from old
        while (oi < foundInOld) {
          if (oldLines[oi].trim()) removed.push(oldLines[oi])
          oi++
        }
      } else {
        // Line was replaced
        if (oldLines[oi].trim()) removed.push(oldLines[oi])
        if (newLines[ni].trim()) added.push(newLines[ni])
        oi++
        ni++
      }
    }
  }

  while (oi < oldLines.length) {
    if (oldLines[oi].trim()) removed.push(oldLines[oi])
    oi++
  }
  while (ni < newLines.length) {
    if (newLines[ni].trim()) added.push(newLines[ni])
    ni++
  }

  return {
    added: added.slice(0, 20),
    removed: removed.slice(0, 20),
    summary: formatSummary(added.length, removed.length, added)
  }
}

function formatSummary(addedCount: number, removedCount: number, addedLines: string[]): string {
  let summary = ''
  if (addedCount && removedCount) {
    summary = `${addedCount} line${addedCount !== 1 ? 's' : ''} added, ${removedCount} removed`
  } else if (addedCount) {
    summary = `${addedCount} line${addedCount !== 1 ? 's' : ''} added`
  } else if (removedCount) {
    summary = `${removedCount} line${removedCount !== 1 ? 's' : ''} removed`
  } else {
    return 'Formatting changes'
  }

  const meaningful = addedLines.filter(l => !l.startsWith('#') && !l.startsWith('---') && l.length > 3)
  if (meaningful.length > 0) {
    const preview = meaningful[0].slice(0, 120)
    summary += ` — "${preview}${meaningful[0].length > 120 ? '...' : ''}"`
  }
  return summary
}

export class ActivityStore {
  private entries: ActivityEntry[] = []
  private storePath: string
  private snapshotsDir: string
  private vaultPath: string = ''
  private contentCache = new Map<string, string>()
  private dirty = false
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  constructor(configDir: string) {
    this.storePath = join(configDir, 'activity.json')
    this.snapshotsDir = join(configDir, 'activity-snapshots')
  }

  setVaultPath(path: string) {
    this.vaultPath = path
  }

  async load() {
    await mkdir(join(this.storePath, '..'), { recursive: true })
    await mkdir(this.snapshotsDir, { recursive: true })
    try {
      const raw = await readFile(this.storePath, 'utf-8')
      this.entries = JSON.parse(raw)
    } catch {
      this.entries = []
    }
  }

  private async saveSnapshot(entryId: string, content: string) {
    await writeFile(join(this.snapshotsDir, `${entryId}.txt`), content, 'utf-8')
  }

  private async loadSnapshot(entryId: string): Promise<string | null> {
    try {
      return await readFile(join(this.snapshotsDir, `${entryId}.txt`), 'utf-8')
    } catch {
      return null
    }
  }

  async save() {
    await writeFile(this.storePath, JSON.stringify(this.entries.slice(0, MAX_ENTRIES), null, 2), 'utf-8')
    this.dirty = false
  }

  private scheduleSave() {
    if (this.saveTimer) return
    this.dirty = true
    this.saveTimer = setTimeout(async () => {
      this.saveTimer = null
      if (this.dirty) await this.save()
    }, 5000)
  }

  /** Snapshot file content for later diff comparison */
  cacheContent(relPath: string, content: string) {
    this.contentCache.set(relPath, content)
  }

  recordCreated(relPath: string, content: string) {
    const lines = content.split('\n').filter(l => l.trim()).length
    const entry: ActivityEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      type: 'created',
      path: relPath,
      label: friendlyLabel(relPath),
      category: categorize(relPath),
      summary: `New file with ${lines} line${lines !== 1 ? 's' : ''}`,
      changeCount: lines,
      canRevert: true
    }
    this.push(entry)
    this.contentCache.set(relPath, content)
    return entry
  }

  recordModified(relPath: string, newContent: string) {
    const oldContent = this.contentCache.get(relPath) || ''
    const diff = computeDiff(oldContent, newContent)

    if (diff.added.length === 0 && diff.removed.length === 0) return null

    const entry: ActivityEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      type: 'modified',
      path: relPath,
      label: friendlyLabel(relPath),
      category: categorize(relPath),
      summary: diff.summary,
      linesAdded: diff.added,
      linesRemoved: diff.removed,
      changeCount: diff.added.length + diff.removed.length,
      canRevert: true
    }
    this.push(entry)
    // Save the old content as a snapshot for rollback
    if (oldContent) {
      this.saveSnapshot(entry.id, oldContent)
    }
    this.contentCache.set(relPath, newContent)
    return entry
  }

  recordDeleted(relPath: string) {
    const oldContent = this.contentCache.get(relPath) || ''
    const entry: ActivityEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      type: 'deleted',
      path: relPath,
      label: friendlyLabel(relPath),
      category: categorize(relPath),
      summary: 'File removed',
      canRevert: !!oldContent
    }
    this.push(entry)
    // Save full content so deleted files can be restored
    if (oldContent) {
      this.saveSnapshot(entry.id, oldContent)
    }
    this.contentCache.delete(relPath)
    return entry
  }

  private push(entry: ActivityEntry) {
    this.entries.unshift(entry)
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(0, MAX_ENTRIES)
    }
    this.scheduleSave()
  }

  getRecent(limit = 50, category?: string): ActivityEntry[] {
    let filtered = this.entries
    if (category && category !== 'all') {
      filtered = filtered.filter(e => e.category === category)
    }
    return filtered.slice(0, limit)
  }

  async revert(entryId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.vaultPath) return { success: false, error: 'Vault path not set' }

    const entry = this.entries.find(e => e.id === entryId)
    if (!entry) return { success: false, error: 'Entry not found' }
    if (!entry.canRevert) return { success: false, error: 'This change cannot be reverted' }

    const fullPath = join(this.vaultPath, entry.path)

    try {
      if (entry.type === 'created') {
        // Revert creation = delete the file
        await unlink(fullPath)
        entry.canRevert = false
        this.scheduleSave()
        return { success: true }
      }

      if (entry.type === 'modified') {
        // Revert modification = restore previous content from snapshot
        const snapshot = await this.loadSnapshot(entry.id)
        if (!snapshot) return { success: false, error: 'Snapshot not found — cannot revert' }
        await writeFile(fullPath, snapshot, 'utf-8')
        this.contentCache.set(entry.path, snapshot)
        entry.canRevert = false
        this.scheduleSave()
        return { success: true }
      }

      if (entry.type === 'deleted') {
        // Revert deletion = recreate the file from snapshot
        const snapshot = await this.loadSnapshot(entry.id)
        if (!snapshot) return { success: false, error: 'Snapshot not found — cannot restore' }
        await mkdir(dirname(fullPath), { recursive: true })
        await writeFile(fullPath, snapshot, 'utf-8')
        this.contentCache.set(entry.path, snapshot)
        entry.canRevert = false
        this.scheduleSave()
        return { success: true }
      }

      return { success: false, error: 'Unknown entry type' }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Revert failed' }
    }
  }

  getCategories(): { id: string; label: string; count: number }[] {
    const counts = new Map<string, number>()
    for (const e of this.entries) {
      counts.set(e.category, (counts.get(e.category) || 0) + 1)
    }
    const labels: Record<string, string> = {
      person: 'People', meeting: 'Meetings', project: 'Projects',
      task: 'Tasks', competitor: 'Competitors', company: 'Companies',
      career: 'Career', idea: 'Ideas', goal: 'Goals',
      priority: 'Priorities', resource: 'Resources', note: 'Notes'
    }
    return Array.from(counts.entries())
      .map(([id, count]) => ({ id, label: labels[id] || id, count }))
      .sort((a, b) => b.count - a.count)
  }
}
