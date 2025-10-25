import type { ModelMessage, Tool } from 'ai'
import type { SSEEvent } from '@/lib/sse-utils'

/**
 * Standardized usage metrics across all providers
 */
export type Usage = {
  /** Base input tokens (not cached) */
  inputTokens: number
  /** Output/completion tokens generated */
  outputTokens: number
  /** Cache read tokens (if supported by provider) */
  cacheReadTokens?: number
  /** Cache write/creation tokens (if supported by provider) */
  cacheWriteTokens?: number
}

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
  getJsonFromSSE(events: SSEEvent[]): any

  /**
   * Converts provider-specific usage data to standardized Usage format
   * @param usage Raw usage data from the provider
   * @returns Standardized usage metrics
   */
  getUsage(usage: any): Usage | null

  /**
   * Converts a ConversationModel back to the provider's response format
   * @param conversation The standardized conversation model
   */
  toResponse?(conversation: ConversationModel): any
}
