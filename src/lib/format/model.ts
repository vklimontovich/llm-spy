import type { ModelMessage, Tool } from 'ai'
import type { SSEEvent } from '@/lib/sse-utils'

export type ConversationModel = {
  modelMessages: ModelMessage[]
  models: {
    request: string
    response?: string
  }

  usage?: {
    inputTokens: number
    outputTokens: number
  }

  tools: Tool[]
  meta: {
    model: string
    maxTokens?: number
    stream?: boolean
    metadata?: unknown
  }
}

export interface ProviderParser {
  getParserName(): string

  /**
   * Creates a standardized conversation model from a provider-specific payload.
   * @param payloadUnknown request payload from the provider (JSON)
   * @param responseUnknown optional response payload from the provider (JSON)
   */
  createConversation(
    payloadUnknown: unknown,
    responseUnknown?: unknown
  ): ConversationModel | undefined

  /**
   * Parses a stream of Server-Sent Events (SSE) from the provider into a JSON object that is returned
   * in non-streaming responses by this provider.
   * @param events
   */
  parseSSE(events: SSEEvent[]): any

  /**
   * Converts a ConversationModel back to the provider's response format
   * @param conversation The standardized conversation model
   */
  toResponse?(conversation: ConversationModel): any
}
