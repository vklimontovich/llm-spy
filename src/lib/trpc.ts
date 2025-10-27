import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '@/server/routers/_app'
import { useMemo } from 'react'
import { useWorkspace } from '@/contexts/WorkspaceContext'

/**
 * Hook to get a vanilla tRPC client with workspace context
 * Returns a client that automatically includes X-Workspace-Id header
 *
 * @example
 * const trpc = useWorkspaceTrpc()
 * const { data } = useQuery({
 *   queryKey: ['upstreams'],
 *   queryFn: () => trpc.upstreams.list.query()
 * })
 */
export function useWorkspaceTrpc() {
  const { workspace } = useWorkspace()

  return useMemo(
    () =>
      createTRPCProxyClient<AppRouter>({
        links: [
          httpBatchLink({
            url: '/api/trpc',
            headers: { 'X-Workspace-Id': workspace.id },
          }),
        ],
      }),
    [workspace.id]
  )
}
