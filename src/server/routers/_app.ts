import { router } from '../trpc'
import { requestsRouter } from './requests'
import { conversationsRouter } from './conversations'
import { upstreamsRouter } from './upstreams'
import { workspacesRouter } from './workspaces'
import { keysRouter } from './keys'

export const appRouter = router({
  requests: requestsRouter,
  conversations: conversationsRouter,
  upstreams: upstreamsRouter,
  workspaces: workspacesRouter,
  keys: keysRouter,
})

export type AppRouter = typeof appRouter
