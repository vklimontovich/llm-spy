import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, workspaceProcedure, publicProcedure } from '../trpc'
import { prisma } from '@/lib/prisma'
import { selectLlmCalls } from '@/lib/db_queries'
import { FiltersSchema } from '@/schemas/requests'
import { requireDefined } from '@/lib/preconditions'
import { parseSSEEvents } from '@/lib/sse-utils'
import { getParserForProvider } from '@/lib/format'
import { hasAuth } from '@/lib/auth'
import { maskSecurityValues } from '@/lib/security'

export const requestsRouter = router({
  /**
   * List LLM calls with pagination and filters
   */
  list: workspaceProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        filter: FiltersSchema.optional(),
        timeRange: z.tuple([z.string(), z.string()]).optional(),
        timeRangePreset: z
          .enum([
            'last15m',
            'last1h',
            'last4h',
            'last1d',
            'last2d',
            'last3d',
            'last1w',
            'last15d',
            'last1m',
          ])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { items: responses, aggregate } = await selectLlmCalls({
        workspaceId: ctx.workspace.id,
        cursor: input.cursor,
        limit: input.limit + 1,
        filters: input.filter || { fieldFilters: [] },
        timeRange: input.timeRange,
        timeRangePreset: input.timeRangePreset,
      })

      const hasNextPage = responses.length > input.limit
      const items = hasNextPage ? responses.slice(0, -1) : responses
      const nextCursor = hasNextPage ? responses[responses.length - 2].id : null

      // Process items to add content-type
      const processedItems = items.map(item => ({
        ...item,
        responseContentType:
          item.responseHeaders && typeof item.responseHeaders === 'object'
            ? (item.responseHeaders as any)['content-type'] || '-'
            : '-',
      }))

      return {
        items: processedItems,
        nextCursor,
        hasNextPage,
        aggregate,
      }
    }),

  /**
   * Get request and response body with parsing
   */
  getBody: publicProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const response = requireDefined(
        await prisma.response.findUnique({ where: { id: input.id } }),
        `Response ${input.id} not found`
      )

      // Check access if not public
      if (!response.public) {
        if (!ctx.session?.user?.email) {
          throw new TRPCError({ code: 'UNAUTHORIZED' })
        }

        // Get the workspace from the response
        if (!response.workspaceId) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Response has no associated workspace',
          })
        }

        // Verify user has access to the response's workspace
        const { requireWorkspaceAccess } = await import('@/lib/auth')
        await requireWorkspaceAccess(
          response.workspaceId,
          ctx.session.user.email
        )
      }

      const requestBody = response.requestBody
      const responseBody = response.responseBody
      let requestHeaders = response.requestHeaders as Record<string, string>
      let responseHeaders = response.responseHeaders as Record<string, string>

      // Mask security headers if response is public
      if (response.public) {
        requestHeaders = maskSecurityValues(requestHeaders, { maskPII: true })
        responseHeaders = maskSecurityValues(responseHeaders, { maskPII: true })
      }

      // Process request
      let rawRequestBody: any = null
      if (requestBody) {
        const requestText =
          requestBody instanceof Uint8Array
            ? new TextDecoder().decode(requestBody)
            : typeof requestBody === 'string'
              ? requestBody
              : JSON.stringify(requestBody)

        try {
          rawRequestBody = JSON.parse(requestText)
        } catch {
          rawRequestBody = requestText
        }
      }

      const providerName = response.provider || 'anthropic'

      // Process response
      let rawResponseBody: any = null
      const provider = requireDefined(
        getParserForProvider(providerName),
        `No parser found for provider ${providerName}`
      )

      let rawResponseJson
      if (responseBody) {
        const responseText =
          responseBody instanceof Uint8Array
            ? new TextDecoder().decode(responseBody)
            : typeof responseBody === 'string'
              ? responseBody
              : JSON.stringify(responseBody)

        const responseContentType = responseHeaders?.['content-type'] || ''
        if (responseContentType.includes('text/event-stream')) {
          rawResponseJson = parseSSEEvents(responseText)
          rawResponseBody = responseText
          if (provider) {
            rawResponseJson = provider.getJsonFromSSE(rawResponseJson)
          }
        } else {
          try {
            rawResponseJson = rawResponseBody = JSON.parse(responseText)
          } catch {
            rawResponseBody = responseText
          }
        }
      }

      const rawRequest = {
        headers: requestHeaders,
        body: rawRequestBody,
        method: response.method,
        url: response.url,
        bodySize: response.requestBody?.length || 0,
        createdAt: response.createdAt,
      }

      const rawResponse = {
        headers: responseHeaders,
        body: rawResponseBody,
        status: response.status,
        bodySize: response.responseBody?.length || 0,
      }

      let conversationNotAvailableReason: string | undefined = undefined
      let conversation
      try {
        conversation = provider.createConversation({
          request: rawRequestBody,
          response: rawResponseJson,
          url: response.requestUrl || response.url,
          method: response.requestMethod || response.method,
        })
      } catch (error) {
        console.error('Error creating conversation model:', error)
        conversationNotAvailableReason = `Error creating conversation model: ${(error as Error).message}`
      }

      return {
        provider: provider?.getParserName(),
        rawResponse,
        rawRequest,
        conversation,
        requestId: response.id,
        public: response.public,
        conversationNotAvailableReason,
      }
    }),

  /**
   * Get public status of a request
   */
  getStatus: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const requestData = await prisma.response.findUnique({
        where: {
          id: input.id,
          workspaceId: ctx.workspace.id,
        },
        select: {
          public: true,
        },
      })

      if (!requestData) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Request not found',
        })
      }

      return { public: requestData.public }
    }),

  /**
   * Get public share info for a request
   */
  getPublic: publicProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ input }) => {
      const requestExists = await prisma.response.findFirst({
        where: { id: input.id },
        select: { id: true, public: true },
      })

      if (!requestExists) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Request not found',
        })
      }

      if (!requestExists?.public && !(await hasAuth())) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'This request is not publicly shared',
        })
      }

      const response = await prisma.response.findFirst({
        where: {
          id: input.id,
        },
        select: {
          id: true,
          url: true,
          method: true,
          status: true,
          requestHeaders: true,
          responseHeaders: true,
          createdAt: true,
          public: true,
        },
      })

      if (!response) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Request not found or not shared',
        })
      }

      // Calculate body sizes
      const requestBodySize = response.requestHeaders
        ? Buffer.from(JSON.stringify(response.requestHeaders)).length
        : 0
      const responseBodySize = response.responseHeaders
        ? Buffer.from(JSON.stringify(response.responseHeaders)).length
        : 0

      const responseContentType =
        response.responseHeaders?.['content-type'] || null

      return {
        ...response,
        requestBodySize,
        responseBodySize,
        responseContentType,
      }
    }),

  /**
   * Set public sharing status for a request
   */
  setPublic: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
        public: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updatedResponse = await prisma.response.update({
        where: {
          id: input.id,
          workspaceId: ctx.workspace.id,
        },
        data: { public: input.public },
        select: { id: true, public: true },
      })

      return updatedResponse
    }),
})
