import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { prisma } from '@/lib/prisma'
import { assertDefined, requireDefined } from '@/lib/preconditions'

export const workspacesRouter = router({
  /**
   * Get workspace by ID or slug
   */
  getByIdOrSlug: protectedProcedure
    .input(
      z.object({
        workspaceIdOrSlug: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      assertDefined(ctx.session.user, 'Session user is missing')
      const email = requireDefined(
        ctx.session.user.email,
        'User email is missing'
      )

      const workspace = await prisma.workspace.findFirst({
        where: {
          OR: [
            { id: input.workspaceIdOrSlug },
            { slug: input.workspaceIdOrSlug },
          ],
          users: { some: { user: { email } } },
        },
        select: {
          id: true,
          slug: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          users: {
            where: {
              user: {
                email,
              },
            },
            select: {
              role: true,
            },
          },
        },
      })

      if (!workspace) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workspace not found or access denied',
        })
      }

      return {
        id: workspace.id,
        slug: workspace.slug,
        name: workspace.name,
        role: workspace.users[0]?.role || 'member',
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      }
    }),
})
