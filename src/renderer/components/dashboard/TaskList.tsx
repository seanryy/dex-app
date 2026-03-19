import { useTasks } from '../../hooks/useVault'
import { CheckCircle2, Circle, ListTodo } from 'lucide-react'

export function TaskList() {
  const { data: tasks, loading } = useTasks()

  if (loading) return <TaskListSkeleton />

  const totalTasks = tasks.pillars.reduce((sum, p) => sum + p.tasks.length, 0)

  return (
    <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ListTodo className="w-4.5 h-4.5 text-accent" />
          <h2 className="font-semibold text-sm">Tasks</h2>
        </div>
        <span className="text-xs text-text-tertiary">
          {totalTasks} active
        </span>
      </div>

      <div className="divide-y divide-border">
        {tasks.pillars.map(pillar => (
          <div key={pillar.name}>
            <div className="px-5 py-2.5 bg-surface-0/50">
              <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
                {pillar.name}
              </span>
            </div>
            <ul className="px-3 py-1">
              {pillar.tasks.map((task, i) => (
                <li
                  key={task.id || i}
                  className="flex items-start gap-3 px-2 py-2.5 rounded-lg hover:bg-surface-2/50 transition-colors group"
                >
                  <button className="mt-0.5 flex-shrink-0 text-text-tertiary hover:text-accent transition-colors">
                    {task.done
                      ? <CheckCircle2 className="w-4.5 h-4.5 text-success" />
                      : <Circle className="w-4.5 h-4.5" />
                    }
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm leading-snug ${task.done ? 'text-text-tertiary line-through' : 'text-text-primary'}`}>
                      {task.text}
                    </p>
                    {task.source && (
                      <p className="text-xs text-text-tertiary mt-0.5 truncate">
                        from: {task.source}
                      </p>
                    )}
                  </div>
                </li>
              ))}
              {pillar.tasks.length === 0 && (
                <li className="px-2 py-3 text-sm text-text-tertiary italic">No tasks</li>
              )}
            </ul>
          </div>
        ))}

        {tasks.pillars.length === 0 && (
          <div className="px-5 py-8 text-center text-text-tertiary text-sm">
            No tasks yet. Start by adding one through the chat.
          </div>
        )}
      </div>
    </div>
  )
}

function TaskListSkeleton() {
  return (
    <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="h-4 w-16 bg-surface-2 rounded animate-pulse" />
      </div>
      <div className="p-3 space-y-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-3 px-2 py-2.5">
            <div className="w-4.5 h-4.5 rounded-full bg-surface-2 animate-pulse" />
            <div className="h-4 bg-surface-2 rounded animate-pulse flex-1" />
          </div>
        ))}
      </div>
    </div>
  )
}
