import { useState, useEffect, useCallback } from 'react'
import type {
  VaultTasks,
  VaultProject,
  VaultMeeting,
  VaultPerson,
  VaultConfig
} from '../../preload/index'

export function useVaultData<T>(
  fetcher: () => Promise<T>,
  defaultValue: T
) {
  const [data, setData] = useState<T>(defaultValue)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setLoading(true)
    fetcher()
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [fetcher])

  useEffect(() => {
    refresh()
    const unsubscribe = window.dex.system.onVaultChange(() => {
      refresh()
    })
    return unsubscribe
  }, [refresh])

  return { data, loading, error, refresh }
}

export function useTasks() {
  return useVaultData<VaultTasks>(
    useCallback(() => window.dex.vault.getTasks(), []),
    { pillars: [] }
  )
}

export function useProjects() {
  return useVaultData<VaultProject[]>(
    useCallback(() => window.dex.vault.getProjects(), []),
    []
  )
}

export function useRecentMeetings(limit = 5) {
  return useVaultData<VaultMeeting[]>(
    useCallback(() => window.dex.vault.getRecentMeetings(limit), [limit]),
    []
  )
}

export function usePeople() {
  return useVaultData<VaultPerson[]>(
    useCallback(() => window.dex.vault.getPeople(), []),
    []
  )
}

export function useConfig() {
  return useVaultData<VaultConfig | null>(
    useCallback(() => window.dex.vault.getConfig(), []),
    null
  )
}
