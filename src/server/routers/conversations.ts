import { router, workspaceProcedure } from '../trpc'
import { selectLlmCalls } from '@/lib/db_queries'
import { Conversation } from '@/schemas/requests'

export const conversationsRouter = router({
  /**
   * List conversations with aggregated usage and pricing
   */
  list: workspaceProcedure.query(async ({ ctx }) => {
    // Fetch all LLM calls for the workspace
    const { items: responses } = await selectLlmCalls({
      workspaceId: ctx.workspace.id,
      limit: 10000, // High limit to get all conversations
    })

    // Group by conversationId and aggregate
    const conversationMap = new Map<
      string,
      {
        conversationId: string
        lastLlmCall: Date
        totalInputTokens: number
        totalOutputTokens: number
        totalPrice: number
      }
    >()

    for (const response of responses) {
      const conversationId = response.conversationId
      if (!conversationId) continue

      const existing = conversationMap.get(conversationId)
      const createdAt = new Date(response.createdAt)

      // Extract usage information
      let inputTokens = 0
      let outputTokens = 0
      if (response.usage) {
        inputTokens =
          response.usage.prompt_tokens || response.usage.input_tokens || 0
        outputTokens =
          response.usage.completion_tokens || response.usage.output_tokens || 0
      }

      // Extract pricing information
      let price = 0
      if (response.pricing && typeof response.pricing === 'object') {
        price = response.pricing.total || 0
      }

      if (!existing) {
        conversationMap.set(conversationId, {
          conversationId,
          lastLlmCall: createdAt,
          totalInputTokens: inputTokens,
          totalOutputTokens: outputTokens,
          totalPrice: price,
        })
      } else {
        // Update with latest call and accumulate totals
        if (createdAt > existing.lastLlmCall) {
          existing.lastLlmCall = createdAt
        }
        existing.totalInputTokens += inputTokens
        existing.totalOutputTokens += outputTokens
        existing.totalPrice += price
      }
    }

    // Convert to array and format for response
    const conversations: Conversation[] = Array.from(conversationMap.values())
      .map(conv => ({
        conversationId: conv.conversationId,
        lastLlmCall: conv.lastLlmCall.toISOString(),
        usage: {
          input_tokens: conv.totalInputTokens,
          output_tokens: conv.totalOutputTokens,
          total_tokens: conv.totalInputTokens + conv.totalOutputTokens,
        },
        totalPrice: conv.totalPrice,
      }))
      .sort(
        (a, b) =>
          new Date(b.lastLlmCall).getTime() - new Date(a.lastLlmCall).getTime()
      )

    return {
      conversations,
    }
  }),
})
