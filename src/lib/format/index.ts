export {
  anthropicToModel,
  AnthropicWireSchema,
  type AnthropicWire,
  AnthropicParser,
} from './anthropic'
export type { ConversationModel, ProviderParser } from './model'

import { AnthropicParser } from './anthropic'
import type { ProviderParser } from './model'

/**
 * Returns the appropriate parser for a given payload
 * @param payloadUnknown - The request payload to analyze
 * @returns A ProviderParser instance or undefined if no matching parser found
 */
export function getProvider(
  payloadUnknown: unknown
): ProviderParser | undefined {
  if (!payloadUnknown || typeof payloadUnknown !== 'object') {
    return undefined
  }

  const payload = payloadUnknown as Record<string, unknown>

  // Check for Anthropic format
  if ('model' in payload && 'messages' in payload) {
    const model = payload.model
    if (typeof model === 'string' && model.includes('claude')) {
      return new AnthropicParser()
    }

    // Additional check for Anthropic structure
    if (Array.isArray(payload.messages)) {
      const hasAnthropicStructure = payload.messages.some(
        (msg: any) =>
          msg?.content &&
          Array.isArray(msg.content) &&
          msg.content.some(
            (part: any) =>
              part?.type === 'tool_use' || part?.type === 'tool_result'
          )
      )
      if (hasAnthropicStructure) {
        return new AnthropicParser()
      }
    }
  }

  // Add more provider checks here as needed
  // e.g., OpenAI, Google, etc.

  return undefined
}

export function getProviderByName(name: string): ProviderParser | undefined {
  if (name === 'anthropic') {
    return new AnthropicParser()
  }
  return undefined
}
