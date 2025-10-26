import { NextRequest, NextResponse } from 'next/server'
import { checkWorkspaceAuth } from '@/lib/auth'
import { selectLlmCalls } from '@/lib/db_queries'
import { Conversation } from '@/types/requests'

export async function GET(request: NextRequest) {
  try {
    const { workspace } = await checkWorkspaceAuth(request)

    // Fetch all LLM calls for the workspace (ordered by conversation)
    const responses = await selectLlmCalls({
      workspaceId: workspace.id,
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

    return NextResponse.json({
      conversations,
    })
  } catch (error) {
    console.error('Error fetching conversations:', error)
    if (
      error instanceof Error &&
      (error.message.includes('X-Workspace-Id') ||
        error.message.includes('Workspace not found') ||
        error.message.includes('Unauthorized'))
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message.includes('Unauthorized') ? 401 : 400 }
      )
    }
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
