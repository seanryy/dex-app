import { useProjects } from '../../hooks/useVault'
import { FolderKanban, ArrowUpRight } from 'lucide-react'

export function ProjectCards() {
  const { data: projects, loading } = useProjects()

  if (loading) return <ProjectCardsSkeleton />

  return (
    <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <FolderKanban className="w-4.5 h-4.5 text-purple-400" />
          <h2 className="font-semibold text-sm">Projects</h2>
        </div>
        <span className="text-xs text-text-tertiary">{projects.length} active</span>
      </div>

      <ul className="p-2">
        {projects.map(project => (
          <li
            key={project.path}
            className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-2/50 transition-colors group cursor-pointer"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary truncate">{project.name}</p>
              {project.status && (
                <p className="text-xs text-text-tertiary mt-0.5">{project.status}</p>
              )}
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </li>
        ))}

        {projects.length === 0 && (
          <li className="px-3 py-6 text-center text-text-tertiary text-sm">
            No projects found
          </li>
        )}
      </ul>
    </div>
  )
}

function ProjectCardsSkeleton() {
  return (
    <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="h-4 w-20 bg-surface-2 rounded animate-pulse" />
      </div>
      <div className="p-2 space-y-1">
        {[1, 2, 3].map(i => (
          <div key={i} className="px-3 py-3">
            <div className="h-4 bg-surface-2 rounded animate-pulse w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}
