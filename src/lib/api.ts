import axios, { AxiosInstance } from 'axios'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { useMemo } from 'react'

export function useWorkspaceApi(): AxiosInstance {
  const { workspace } = useWorkspace()

  return useMemo(() => {
    const client = axios.create({
      baseURL: '/api',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    client.defaults.headers.common['X-Workspace-Id'] = workspace.id
    return client
  }, [workspace.id])
}
