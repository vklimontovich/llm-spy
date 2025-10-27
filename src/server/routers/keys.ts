import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { toKeyModel } from '@/lib/auth'

export const keysRouter = router({
  /**
   * List auth keys for a workspace
   */
  list: protectedProcedure
    .input(
      z.object({
        workspaceIdOrSlug: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.session?.user?.email) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      // Find workspace and verify user has access
      const workspace = await prisma.workspace.findFirst({
        where: {
          OR: [
            { id: input.workspaceIdOrSlug },
            { slug: input.workspaceIdOrSlug },
          ],
          users: {
            some: {
              user: {
                email: ctx.session.user.email,
              },
            },
          },
        },
        include: {
          authKeys: {
            where: {
              deletedAt: null,
            },
            orderBy: {
              createdAt: 'desc',
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

      // Return keys using KeyModel
      const keys = workspace.authKeys.map(key => toKeyModel(key))

      return keys
    }),

  /**
   * Create a new auth key
   */
  create: protectedProcedure
    .input(
      z.object({
        workspaceIdOrSlug: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.user?.email) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      // Find workspace and verify user has admin/owner access
      const workspace = await prisma.workspace.findFirst({
        where: {
          OR: [
            { id: input.workspaceIdOrSlug },
            { slug: input.workspaceIdOrSlug },
          ],
          users: {
            some: {
              user: {
                email: ctx.session.user.email,
              },
              role: { in: ['admin', 'owner'] }, // Only admins/owners can create keys
            },
          },
        },
      })

      if (!workspace) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workspace not found or insufficient permissions',
        })
      }

      // Generate a secure API key
      const apiKey = `sk_${crypto.randomBytes(32).toString('base64url')}`

      const authKey = await prisma.authKey.create({
        data: {
          key: apiKey,
          workspaceId: workspace.id,
          hashed: false,
        },
      })

      return {
        id: authKey.id,
        key: apiKey, // Return full key only on creation
        createdAt: authKey.createdAt,
      }
    }),

  /**
   * Delete an auth key (soft delete)
   */
  delete: protectedProcedure
    .input(
      z.object({
        workspaceIdOrSlug: z.string(),
        keyId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.user?.email) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      // Find workspace and verify user has admin/owner access
      const workspace = await prisma.workspace.findFirst({
        where: {
          OR: [
            { id: input.workspaceIdOrSlug },
            { slug: input.workspaceIdOrSlug },
          ],
          users: {
            some: {
              user: {
                email: ctx.session.user.email,
              },
              role: { in: ['admin', 'owner'] }, // Only admins/owners can delete keys
            },
          },
        },
      })

      if (!workspace) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workspace not found or insufficient permissions',
        })
      }

      // Soft delete the auth key
      await prisma.authKey.update({
        where: {
          id: input.keyId,
          workspaceId: workspace.id,
        },
        data: {
          deletedAt: new Date(),
        },
      })

      return { success: true }
    }),

  /**
   * Reveal the full auth key
   */
  reveal: protectedProcedure
    .input(
      z.object({
        workspaceIdOrSlug: z.string(),
        keyId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.user?.email) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      // Find workspace and verify user has access
      const workspace = await prisma.workspace.findFirst({
        where: {
          OR: [
            { id: input.workspaceIdOrSlug },
            { slug: input.workspaceIdOrSlug },
          ],
          users: {
            some: {
              user: {
                email: ctx.session.user.email,
              },
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

      // Find the key
      const authKey = await prisma.authKey.findFirst({
        where: {
          id: input.keyId,
          workspaceId: workspace.id,
          deletedAt: null,
        },
      })

      if (!authKey) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Key not found',
        })
      }

      // Check if key is hashed
      if (authKey.hashed) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot reveal hashed key',
        })
      }

      return { key: authKey.key }
    }),
})
