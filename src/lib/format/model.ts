import type { ModelMessage, Tool } from 'ai'
import type { SSEEvent } from '@/lib/sse-utils'

/**
 * Standardized usage metrics across all providers
 */
export type Usage = {
  /**
   * Base input tokens - does NOT include cached tokens.
   * This represents only the non-cached input tokens that were processed.
   */
  inputTokens: number
  /**
   * Output/completion tokens generated - does NOT include any cached tokens.
   * This represents the tokens generated in the response.
   */
  outputTokens: number
  /**
   * Cache read tokens (if supported by provider).
   * Tokens that were retrieved from cache rather than processed fresh.
   */
  cacheReadTokens?: number
  /**
   * Cache write/creation tokens (if supported by provider).
   * Tokens that were written to cache for future use.
   */
  cacheWriteTokens?: number
}

/**
 * JSON paths to usage fields in provider-specific response format.
 * Each path is a string array representing the path to the field in the JSON object.
 * Example: ["usage", "input_tokens"] represents response.usage.input_tokens
 */
export type UsagePaths = {
  /** Path to base input tokens (not cached) */
  inputTokens: string[]
  /** Path to output/completion tokens */
  outputTokens: string[]
  /** Path to cache read tokens (optional) */
  cacheReadTokens?: string[]
  /** Path to cache write/creation tokens (optional) */
  cacheWriteTokens?: string[]
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
   *
   * @param params Object containing request, response, and optional metadata
   * @param params.request - Full provider-specific request body. This can be JSON object,
   *                         binary protobuf dump, or any other format specific to the provider.
   *                         For REST APIs, this is typically the parsed JSON request body.
   * @param params.response - Full provider-specific response body (optional). Like request,
   *                          this can be JSON, binary data, or provider-specific format.
   *                          For streaming responses, this should be the reconstructed complete response.
   * @param params.url - Optional URL of the request destination
   * @param params.method - Optional HTTP method (GET, POST, etc.)
   * @returns ConversationModel with standardized message format, or undefined if parsing fails
   */
  createConversation(params: {
    request: unknown
    response?: unknown
    url?: string
    method?: string
  }): ConversationModel | undefined

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
   * Returns JSON paths to usage fields in the provider's response format.
   * These paths describe where to find token counts in the provider-specific response object.
   *
   * @returns UsagePaths object with string arrays representing paths to each usage field.
   *          Returns null if the provider doesn't support usage reporting.
   *
   * @example
   * // For a response like { usage: { input_tokens: 100 } }
   * // The path would be: { inputTokens: ["usage", "input_tokens"] }
   */
  getUsagePaths(): UsagePaths | null

  /**
   * Converts a ConversationModel back to the provider's response format
   * @param conversation The standardized conversation model
   */
  toResponse?(conversation: ConversationModel): any
}
