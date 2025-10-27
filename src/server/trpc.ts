import { initTRPC, TRPCError } from '@trpc/server'
import { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import { getSession, requireWorkspaceAccess } from '@/lib/auth'
import { requireDefined } from '@/lib/preconditions'

/**
 * Create context for tRPC requests
 * Extracts session and workspace information from request
 */
export async function createContext(opts: FetchCreateContextFnOptions) {
  const session = await getSession()

  // Extract workspace ID from header or query param
  const workspaceHeader = opts.req.headers.get('X-Workspace-Id')
  const url = new URL(opts.req.url)
  const workspaceIdOrSlug =
    workspaceHeader || url.searchParams.get('workspaceId')

  return {
    session,
    workspaceIdOrSlug,
    req: opts.req,
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>

/**
 * Initialize tRPC
 */
const t = initTRPC.context<Context>().create()

/**
 * Public procedure (no auth required)
 */
export const publicProcedure = t.procedure

/**
 * Middleware that requires user to be authenticated
 */
const isAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user?.email) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      userEmail: ctx.session.user.email,
    },
  })
})

/**
 * Protected procedure (requires authentication)
 */
export const protectedProcedure = t.procedure.use(isAuthed)

/**
 * Middleware that requires workspace access
 */
const hasWorkspaceAccess = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user?.email) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }

  if (!ctx.workspaceIdOrSlug) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'X-Workspace-Id header or workspaceId parameter is required',
    })
  }

  try {
    const workspace = await requireWorkspaceAccess(
      ctx.workspaceIdOrSlug,
      requireDefined(ctx.session.user.email, 'User email is required')
    )

    return next({
      ctx: {
        ...ctx,
        session: ctx.session,
        workspace,
        userEmail: ctx.session.user.email,
      },
    })
  } catch (error) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message:
        error instanceof Error ? error.message : 'Workspace access denied',
    })
  }
})

/**
 * Workspace procedure (requires authentication + workspace access)
 */
export const workspaceProcedure = t.procedure.use(hasWorkspaceAccess)

/**
 * Router creator
 */
export const router = t.router
