import { router, workspaceProcedure } from '../trpc'
import { prisma } from '@/lib/prisma'
import { postProcessResponse } from '@/lib/request-post-processing'
import { z } from 'zod'

export const reprocessRouter = router({
  /**
   * Reprocess all responses where parsing failed (missing request/response models)
   */
  reprocessAll: workspaceProcedure
    .input(
      z.object({
        limit: z.number().int().positive().optional().default(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      console.log(
        `[reprocess] Starting reprocessing for workspace: ${ctx.workspace.id}`
      )

      // Find all responses where model parsing failed
      // Order by latest first and limit to specified number (default 100)
      const responsesToReprocess = await prisma.response.findMany({
        where: {
          workspaceId: ctx.workspace.id,
        },
        select: {
          id: true,
          requestBody: true,
          responseBody: true,
          requestHeaders: true,
          responseHeaders: true,
          provider: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: input.limit,
      })

      console.log(
        `[reprocess] Found ${responsesToReprocess.length} responses to reprocess`
      )

      let successCount = 0
      let failureCount = 0

      // Reprocess each response
      for (const response of responsesToReprocess) {
        try {
          // Skip if no response body
          if (!response.responseBody) {
            console.log(`[reprocess] Skipping ${response.id}: no response body`)
            failureCount++
            continue
          }

          // Convert requestBody and responseBody to Buffer if needed
          const requestBody = response.requestBody
            ? Buffer.from(response.requestBody)
            : null
          const responseBody = Buffer.from(response.responseBody)
          const requestHeaders = response.requestHeaders as Record<
            string,
            string
          >
          const responseHeaders = response.responseHeaders as Record<
            string,
            string
          >

          // Post-process the response
          const postProcessed = await postProcessResponse({
            requestBody,
            responseBody,
            requestHeaders,
            responseHeaders,
            provider: response.provider,
          })

          // Update the response with extracted metadata
          await prisma.response.update({
            where: { id: response.id },
            data: {
              provider: postProcessed.provider,
              requestModel: postProcessed.requestModel,
              responseModel: postProcessed.responseModel,
              sessionId: postProcessed.sessionId,
              conversationId: postProcessed.conversationId,
              //userId: postProcessed.userId - add when we have userId
              //tags: {accountId: postProcessed.accountId}
              usage: postProcessed.usage,
              pricing: postProcessed.pricing,
              preview: postProcessed.preview,
            },
          })

          console.log(
            `[reprocess] Successfully reprocessed ${response.id} - provider: ${postProcessed.provider}, models: ${postProcessed.requestModel} -> ${postProcessed.responseModel}`
          )
          successCount++
        } catch (error) {
          console.error(
            `[reprocess] Failed to reprocess ${response.id}:`,
            error
          )
          failureCount++
        }
      }

      console.log(
        `[reprocess] Completed - Success: ${successCount}, Failed: ${failureCount}`
      )

      return {
        total: responsesToReprocess.length,
        success: successCount,
        failed: failureCount,
      }
    }),
})
