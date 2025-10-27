import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, workspaceProcedure } from '../trpc'
import { prisma } from '@/lib/prisma'
import { UpstreamSchema } from '@/schemas/upstreams'

export const upstreamsRouter = router({
  /**
   * List all upstreams for a workspace
   */
  list: workspaceProcedure.query(async ({ ctx }) => {
    const upstreams = await prisma.upstream.findMany({
      where: {
        deletedAt: null,
        workspaceId: ctx.workspace.id,
      },
      select: {
        id: true,
        name: true,
        url: true,
        headers: true,
        inputFormat: true,
        outputFormat: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return upstreams
  }),

  /**
   * Create a new upstream
   */
  create: workspaceProcedure
    .input(UpstreamSchema)
    .mutation(async ({ ctx, input }) => {
      const existingUpstream = await prisma.upstream.findFirst({
        where: {
          name: input.name,
          workspaceId: ctx.workspace.id,
        },
      })

      if (existingUpstream) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'An upstream with this name already exists in this workspace',
        })
      }

      const upstream = await prisma.upstream.create({
        data: {
          name: input.name,
          url: input.url || null,
          headers: input.headers,
          inputFormat: input.inputFormat,
          outputFormat: input.outputFormat,
          workspaceId: ctx.workspace.id,
          otelUpstreams: {
            create: input.otelUpstreams.map(otel => ({
              url: otel.url,
              headers: otel.headers || [],
            })),
          },
        },
        include: {
          otelUpstreams: true,
        },
      })

      return upstream
    }),

  /**
   * Get an upstream by ID
   */
  getById: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const upstream = await prisma.upstream.findUnique({
        where: {
          id: input.id,
          deletedAt: null,
          workspaceId: ctx.workspace.id,
        },
        include: {
          otelUpstreams: true,
        },
      })

      if (!upstream) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Upstream not found',
        })
      }

      return upstream
    }),

  /**
   * Update an upstream
   */
  update: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
        data: UpstreamSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existingUpstream = await prisma.upstream.findUnique({
        where: { id: input.id, deletedAt: null, workspaceId: ctx.workspace.id },
        include: { otelUpstreams: true },
      })

      if (!existingUpstream) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Upstream not found',
        })
      }

      const existingWithSameName = await prisma.upstream.findFirst({
        where: {
          name: input.data.name,
          deletedAt: null,
          workspaceId: ctx.workspace.id,
          NOT: { id: input.id },
        },
      })

      if (existingWithSameName) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'An upstream with this name already exists',
        })
      }

      const updatedUpstream = await prisma.$transaction(async tx => {
        await tx.otelUpstream.deleteMany({
          where: { upstreamId: input.id },
        })

        const upstream = await tx.upstream.update({
          where: { id: input.id },
          data: {
            name: input.data.name,
            url: input.data.url || null,
            headers: input.data.headers,
            inputFormat: input.data.inputFormat,
            outputFormat: input.data.outputFormat,
            otelUpstreams: {
              create: input.data.otelUpstreams.map(otel => ({
                url: otel.url,
                headers: otel.headers || [],
              })),
            },
          },
          include: {
            otelUpstreams: true,
          },
        })

        return upstream
      })

      return updatedUpstream
    }),

  /**
   * Delete an upstream (soft delete)
   */
  delete: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existingUpstream = await prisma.upstream.findUnique({
        where: { id: input.id, deletedAt: null, workspaceId: ctx.workspace.id },
      })

      if (!existingUpstream) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Upstream not found',
        })
      }

      await prisma.upstream.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      })

      return { success: true }
    }),
})
