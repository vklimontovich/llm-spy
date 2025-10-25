export {
  anthropicToModel,
  AnthropicWireSchema,
  type AnthropicWire,
  AnthropicParser,
} from './anthropic'
export {
  openaiToModel,
  OpenAIResponsesWireSchema,
  type OpenAIResponsesWire,
  OpenAIResponsesParser,
} from './openai-responses'
export type { ConversationModel, ProviderParser } from './model'

import { AnthropicParser } from './anthropic'
import { OpenAIResponsesParser } from './openai-responses'
import type { ProviderParser } from './model'

const openaiResponsesParser = new OpenAIResponsesParser()

const parsers: Record<string, ProviderParser> = {
  anthropic: new AnthropicParser(),
  openai: openaiResponsesParser, // Legacy/auto-detect fallback
  'openai-chat': openaiResponsesParser, // OpenAI Chat Completion API (not yet implemented, using Responses parser)
  'openai-responses': openaiResponsesParser, // OpenAI Responses API
  // Add more parsers as needed: google, mistral, cohere, meta
}

export function getParserForProvider(
  provider: string | null
): ProviderParser | null {
  if (!provider) return null
  return parsers[provider.toLowerCase()] || null
}

export function detectProviderFromRequest(
  headers: Record<string, string>,
  body?: any
): string | null {
  // Check Anthropic-specific headers
  if (headers['anthropic-version'] || headers['x-anthropic-version']) {
    return 'anthropic'
  }

  // Check OpenAI-specific headers
  if (headers['openai-organization'] || headers['openai-beta']) {
    // Check if it's the new Responses API by looking at body structure
    if (body?.input !== undefined || body?.output !== undefined) {
      return 'openai-responses'
    }
    // Otherwise assume Chat Completion API
    return 'openai-chat'
  }

  // Check body structure
  if (body?.model && typeof body.model === 'string') {
    const model = body.model.toLowerCase()
    if (model.includes('claude')) return 'anthropic'
    // For OpenAI models, try to detect which API based on body structure
    if (model.includes('gpt') || model.includes('o1') || model.includes('o3')) {
      // Responses API has 'input' and/or 'output' fields
      if (body.input !== undefined || body.output !== undefined) {
        return 'openai-responses'
      }
      // Chat Completion API has 'messages' field
      if (body.messages !== undefined) {
        return 'openai-chat'
      }
      // Default to responses if unclear
      return 'openai-responses'
    }
    if (model.includes('gemini')) return 'google'
    if (model.includes('mistral') || model.includes('codestral'))
      return 'mistral'
    if (model.includes('command')) return 'cohere'
    if (model.includes('llama')) return 'meta'
  }

  return null
}
