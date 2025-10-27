import { router } from '../trpc'
import { requestsRouter } from './requests'
import { conversationsRouter } from './conversations'
import { upstreamsRouter } from './upstreams'
import { workspacesRouter } from './workspaces'
import { keysRouter } from './keys'
import { reprocessRouter } from './reprocess'

export const appRouter = router({
  requests: requestsRouter,
  conversations: conversationsRouter,
  upstreams: upstreamsRouter,
  workspaces: workspacesRouter,
  keys: keysRouter,
  reprocess: reprocessRouter,
})

export type AppRouter = typeof appRouter
