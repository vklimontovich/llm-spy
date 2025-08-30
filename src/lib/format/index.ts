export {
  anthropicToModel,
  AnthropicWireSchema,
  type AnthropicWire,
  AnthropicParser,
} from './anthropic'
export type { ConversationModel, ProviderParser } from './model'

import { AnthropicParser } from './anthropic'
import type { ProviderParser } from './model'

const parsers: Record<string, ProviderParser> = {
  anthropic: new AnthropicParser(),
  // Add more parsers as needed: openai, google, mistral, cohere, meta
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
    return 'openai'
  }

  // Check body structure
  if (body?.model && typeof body.model === 'string') {
    const model = body.model.toLowerCase()
    if (model.includes('claude')) return 'anthropic'
    if (model.includes('gpt')) return 'openai'
    if (model.includes('gemini')) return 'google'
    if (model.includes('mistral') || model.includes('codestral'))
      return 'mistral'
    if (model.includes('command')) return 'cohere'
    if (model.includes('llama')) return 'meta'
  }

  return null
}
