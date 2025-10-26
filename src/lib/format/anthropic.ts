import { z } from 'zod'
import type { Tool, ModelMessage } from 'ai'
import type {
  ConversationModel,
  ProviderParser,
  Usage,
} from '@/lib/format/model'
import type { SSEEvent } from '@/lib/sse-utils'

// ──────────────────────────────────────────────────────────
// Anthropic-specific Zod schemas
// ──────────────────────────────────────────────────────────

const AnthropicTextPart = z.object({
  type: z.literal('text'),
  text: z.string(),
})

const AnthropicThinkingPart = z.object({
  type: z.literal('thinking'),
  thinking: z.string(),
  signature: z.string().optional(),
})

const AnthropicToolUsePart = z.object({
  type: z.literal('tool_use'),
  id: z.string().optional(),
  name: z.string(),
  input: z.unknown(),
})

const AnthropicToolResultPart = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string(),
  content: z.unknown().optional(), // string | [{type:'text',text}] | any
  is_error: z.boolean().optional(),
})

const AnthropicContentPart = z.discriminatedUnion('type', [
  AnthropicTextPart,
  AnthropicThinkingPart,
  AnthropicToolUsePart,
  AnthropicToolResultPart,
  // add image/file parts here if needed
])

const AnthropicMessage = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([z.string(), z.array(AnthropicContentPart)]),
})

const AnthropicToolDef = z.object({
  name: z.string(),
  description: z.string().optional(),
  input_schema: z.record(z.string(), z.any()).optional(),
})

const AnthropicSystemMessage = z.object({
  role: z.literal('system'),
  content: z.string(),
})

export const AnthropicWireSchema = z.object({
  model: z.string(),
  messages: z.array(z.union([AnthropicMessage, AnthropicSystemMessage])),
  system: z
    .union([
      z.string(),
      z.array(
        z.object({
          type: z.literal('text'),
          text: z.string(),
          cache_control: z
            .object({
              type: z.string(),
            })
            .optional(),
        })
      ),
    ])
    .optional(),
  tools: z.array(AnthropicToolDef).optional(),
  metadata: z.unknown().optional(),
  max_tokens: z.number().optional(),
  stream: z.boolean().optional(),
  temperature: z.number().nullable().optional(),
})

export type AnthropicWire = z.infer<typeof AnthropicWireSchema>

export function anthropicToModel(
  payloadUnknown: unknown,
  responseUnknown?: unknown
): ConversationModel {
  const payload = AnthropicWireSchema.parse(payloadUnknown)

  const out: ModelMessage[] = []

  // Track tool calls by ID for name resolution
  const toolCallMap = new Map<string, string>() // toolCallId -> toolName

  // Extract model names and usage
  const models: { request: string; response?: string } = {
    request: payload.model,
  }
  let usage: { inputTokens: number; outputTokens: number } | undefined

  // 1) Top-level system - handle multiple system messages
  if (payload.system) {
    if (typeof payload.system === 'string') {
      // Single string system message
      out.push({
        role: 'system',
        content: payload.system,
        providerOptions: { originalMessageGroup: '-1' },
      } as unknown as ModelMessage)
    } else {
      // Array of system message parts - output each as separate system message
      for (const part of payload.system) {
        if (part.text.trim()) {
          out.push({
            role: 'system',
            content: part.text,
            providerOptions: {
              originalMessageGroup: '-1',
              ...(part.cache_control && { cache_control: part.cache_control }),
            },
          } as unknown as ModelMessage)
        }
      }
    }
  }

  // 2) Messages
  for (
    let messageIndex = 0;
    messageIndex < payload.messages.length;
    messageIndex++
  ) {
    const m = payload.messages[messageIndex]

    // Handle system messages in messages array
    if ('role' in m && m.role === 'system' && typeof m.content === 'string') {
      out.push({
        role: 'system',
        content: m.content,
        providerOptions: { originalMessageGroup: String(messageIndex) },
      } as unknown as ModelMessage)
      continue
    }

    // Handle string content (common in user messages)
    if (typeof m.content === 'string') {
      if (m.role === 'user') {
        out.push({
          role: 'user',
          content: m.content,
          providerOptions: { originalMessageGroup: String(messageIndex) },
        } as unknown as ModelMessage)
      } else if (m.role === 'assistant') {
        out.push({
          role: 'assistant',
          content: [{ type: 'text', text: m.content }],
          providerOptions: { originalMessageGroup: String(messageIndex) },
        } as unknown as ModelMessage)
      }
      continue
    }

    const parts = Array.isArray(m.content) ? m.content : []

    // tool_result parts arrive on user turns → map to role:'tool'
    const toolResults = parts.filter(p => p.type === 'tool_result') as z.infer<
      typeof AnthropicToolResultPart
    >[]
    if (toolResults.length) {
      // Tool messages have a different content structure in AI SDK
      for (const tr of toolResults) {
        // Try to find the tool name from previous tool calls
        const toolName = toolCallMap.get(tr.tool_use_id) || 'unknown'

        out.push({
          role: 'tool',
          content: [
            {
              type: 'tool-result' as const,
              toolCallId: tr.tool_use_id,
              toolName,
              output: normalizeToolResult(tr.content),
            },
          ],
          providerOptions: { originalMessageGroup: String(messageIndex) },
        } as unknown as ModelMessage)
      }
    }

    const textParts = parts.filter(p => p.type === 'text') as z.infer<
      typeof AnthropicTextPart
    >[]

    const thinkingParts = parts.filter(p => p.type === 'thinking') as z.infer<
      typeof AnthropicThinkingPart
    >[]

    if (m.role === 'user') {
      if (textParts.length > 0) {
        const content =
          textParts.length === 1
            ? textParts[0].text // user content can be a string
            : textParts.map(tp => ({ type: 'text' as const, text: tp.text }))

        out.push({
          role: 'user',
          content,
          providerOptions: { originalMessageGroup: String(messageIndex) },
        } as unknown as ModelMessage)
      }
    } else {
      // assistant: enforce array-of-parts (no bare string) → fixes your type error
      const toolUses = parts.filter(p => p.type === 'tool_use') as z.infer<
        typeof AnthropicToolUsePart
      >[]

      const assistantContent: any[] = [
        ...thinkingParts.map(tp => ({
          type: 'text' as const,
          text: `[Thinking]\n${tp.thinking}`,
        })),
        ...textParts.map(tp => ({ type: 'text' as const, text: tp.text })),
        ...toolUses.map(tu => {
          const toolCallId = tu.id || `tool-${Date.now()}`
          // Store the mapping for later tool results
          if (tu.id) {
            toolCallMap.set(tu.id, tu.name)
          }
          return {
            type: 'tool-call' as const,
            toolCallId,
            toolName: tu.name,
            args: tu.input,
          }
        }),
      ]

      if (assistantContent.length > 0) {
        out.push({
          role: 'assistant',
          content: assistantContent,
          providerOptions: { originalMessageGroup: String(messageIndex) },
        } as unknown as ModelMessage)
      }
    }
  }

  // 3) Add response if provided
  if (responseUnknown && typeof responseUnknown === 'object') {
    const response = responseUnknown as any

    // Extract response model and usage
    if (response.model) {
      models.response = response.model
    }
    if (response.usage) {
      usage = {
        inputTokens: response.usage.input_tokens || 0,
        outputTokens: response.usage.output_tokens || 0,
      }
    }

    // Check if this is an Anthropic assistant message
    if (response.role === 'assistant' && response.content) {
      const assistantContent: any[] = []
      const messageIndex = payload.messages.length // Use next index for response

      if (typeof response.content === 'string') {
        assistantContent.push({ type: 'text' as const, text: response.content })
      } else if (Array.isArray(response.content)) {
        for (const part of response.content) {
          if (part.type === 'text') {
            assistantContent.push({
              type: 'text' as const,
              text: part.text || '',
            })
          } else if (part.type === 'thinking') {
            assistantContent.push({
              type: 'text' as const,
              text: `[Thinking]\n${part.thinking || ''}`,
            })
          } else if (part.type === 'tool_use') {
            const toolCallId = part.id || `tool-${Date.now()}`
            // Store the mapping for later tool results
            if (part.id) {
              toolCallMap.set(part.id, part.name)
            }
            assistantContent.push({
              type: 'tool-call' as const,
              toolCallId,
              toolName: part.name,
              args: part.input,
            })
          }
        }
      }

      if (assistantContent.length > 0) {
        out.push({
          role: 'assistant',
          content: assistantContent,
          providerOptions: { originalMessageGroup: String(messageIndex) },
        } as unknown as ModelMessage)
      }
    }
  }

  // 4) Tools: map to SDK Tool type (no Zod)
  const tools: Tool[] = (payload.tools ?? []).map<Tool>(
    t =>
      ({
        name: t.name,
        description: t.description,
        inputSchema: t.input_schema || {}, // AI SDK uses 'inputSchema'
      }) as Tool
  )

  return {
    modelMessages: out,
    models,
    usage,
    tools,
    meta: {
      model: payload.model,
      maxTokens: payload.max_tokens,
      stream: payload.stream,
      metadata: payload.metadata,
    },
  }
}

function normalizeToolResult(raw: unknown): unknown {
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) {
    const text = raw
      .map(p =>
        p && typeof p === 'object' && (p as any).type === 'text'
          ? String((p as any).text ?? '')
          : ''
      )
      .filter(Boolean)
      .join('\n')
    if (text) return text
  }
  return raw ?? null
}

/**
 * Parser for Anthropic API format
 */
export class AnthropicParser implements ProviderParser {
  getParserName(): string {
    return 'anthropic'
  }

  createConversation(
    payloadUnknown: unknown | null,
    responseUnknown?: unknown
  ): ConversationModel | undefined {
    if (payloadUnknown === null && responseUnknown) {
      // When payload is null, create minimal conversation from response only
      return this.responseToModel(responseUnknown)
    }
    return anthropicToModel(payloadUnknown, responseUnknown)
  }

  private responseToModel(responseUnknown: unknown): ConversationModel {
    const response = responseUnknown as any
    const out: ModelMessage[] = []
    const models: { request: string; response?: string } = {
      request: response.model || 'unknown',
    }
    let usage: { inputTokens: number; outputTokens: number } | undefined

    if (response.model) {
      models.response = response.model
    }
    if (response.usage) {
      usage = {
        inputTokens: response.usage.input_tokens || 0,
        outputTokens: response.usage.output_tokens || 0,
      }
    }

    if (response.role === 'assistant' && response.content) {
      const assistantContent: any[] = []

      if (typeof response.content === 'string') {
        assistantContent.push({ type: 'text' as const, text: response.content })
      } else if (Array.isArray(response.content)) {
        for (const part of response.content) {
          if (part.type === 'text') {
            assistantContent.push({
              type: 'text' as const,
              text: part.text || '',
            })
          } else if (part.type === 'thinking') {
            assistantContent.push({
              type: 'text' as const,
              text: `[Thinking]\n${part.thinking || ''}`,
            })
          } else if (part.type === 'tool_use') {
            assistantContent.push({
              type: 'tool-call' as const,
              toolCallId: part.id || `tool-${Date.now()}`,
              toolName: part.name,
              args: part.input,
            })
          }
        }
      }

      if (assistantContent.length > 0) {
        out.push({
          role: 'assistant',
          content: assistantContent,
          providerOptions: { originalMessageGroup: '0' },
        } as unknown as ModelMessage)
      }
    }

    return {
      modelMessages: out,
      models,
      usage,
      tools: [],
      meta: {
        model: response.model || 'unknown',
        stream: false,
      },
    }
  }

  toResponse(conversation: ConversationModel): any {
    // Convert ConversationModel back to Anthropic response format
    const lastMessage =
      conversation.modelMessages[conversation.modelMessages.length - 1]

    if (!lastMessage || lastMessage.role !== 'assistant') {
      // Return a minimal assistant response
      return {
        id: `msg_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: '' }],
        model: conversation.meta.model,
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 0,
          output_tokens: 0,
        },
      }
    }

    const content: any[] = []

    if (Array.isArray(lastMessage.content)) {
      for (const part of lastMessage.content) {
        if (part.type === 'text') {
          content.push({ type: 'text', text: part.text })
        } else if (part.type === 'tool-call') {
          content.push({
            type: 'tool_use',
            id: part.toolCallId,
            name: part.toolName,
            input: (part as any).args,
          })
        }
      }
    } else if (typeof lastMessage.content === 'string') {
      content.push({ type: 'text', text: lastMessage.content })
    }

    return {
      id: `msg_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      content,
      model: conversation.meta.model,
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: conversation.usage?.inputTokens || 0,
        output_tokens: conversation.usage?.outputTokens || 0,
      },
    }
  }

  getJsonFromSSE(events: SSEEvent[]): any | undefined {
    if (events.length === 0) return undefined

    let response: any = null
    const contentParts: any[] = []

    for (const event of events) {
      const data = event.data

      // Skip raw string events
      if (data?.raw) continue

      if (data?.type === 'message_start' && data.message) {
        response = data.message
      } else if (data?.type === 'content_block_start' && data.content_block) {
        const index = data.index ?? contentParts.length
        contentParts[index] = data.content_block
      } else if (data?.type === 'content_block_delta' && data.delta) {
        const index = data.index ?? contentParts.length - 1
        if (contentParts[index]) {
          if (data.delta.type === 'text_delta') {
            contentParts[index].text =
              (contentParts[index].text || '') + data.delta.text
          } else if (data.delta.type === 'input_json_delta') {
            contentParts[index].input =
              (contentParts[index].input || '') + data.delta.partial_json
          }
        }
      } else if (data?.type === 'message_delta' && data.delta) {
        if (response) {
          if (data.delta.stop_reason)
            response.stop_reason = data.delta.stop_reason
          // Merge usage updates to avoid dropping fields like input_tokens
          if (data.usage) {
            response.usage = {
              ...(response.usage || {}),
              ...data.usage,
            }
          }
        }
      }
    }

    if (response && contentParts.length > 0) {
      response.content = contentParts.filter(p => p !== undefined)
    }

    return response
  }

  getUsage(usage: any): Usage | null {
    if (!usage) return null

    const inputTokens = Number(usage.input_tokens || 0)
    const outputTokens = Number(usage.output_tokens || 0)

    // Handle cache tokens - both flat and nested formats
    const cacheReadTokens = Number(usage.cache_read_input_tokens || 0)
    const cacheWriteFlat = Number(usage.cache_creation_input_tokens || 0)
    const cacheWriteNested =
      Number(usage.cache_creation?.ephemeral_1h_input_tokens || 0) +
      Number(usage.cache_creation?.ephemeral_5m_input_tokens || 0)
    const cacheWriteTokens = cacheWriteFlat || cacheWriteNested

    return {
      inputTokens,
      outputTokens,
      cacheReadTokens: cacheReadTokens > 0 ? cacheReadTokens : undefined,
      cacheWriteTokens: cacheWriteTokens > 0 ? cacheWriteTokens : undefined,
    }
  }
}
