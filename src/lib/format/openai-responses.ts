import { z } from 'zod'
import type { Tool, ModelMessage } from 'ai'
import type { ConversationModel, ProviderParser, Usage } from '@/lib/format/model'
import type { SSEEvent } from '@/lib/sse-utils'

// ──────────────────────────────────────────────────────────
// OpenAI Responses API Zod schemas
// ──────────────────────────────────────────────────────────

const OpenAIInputTextPart = z.object({
  type: z.literal('input_text'),
  text: z.string(),
})

const OpenAIOutputTextPart = z.object({
  type: z.literal('output_text'),
  text: z.string(),
  annotations: z.array(z.any()).optional(),
})

const OpenAIFunctionCallPart = z.object({
  type: z.literal('function_call'),
  id: z.string().optional(),
  call_id: z.string().optional(),
  name: z.string(),
  arguments: z.string(), // JSON string
  status: z.string().optional(),
})

const OpenAIFunctionCallOutputPart = z.object({
  type: z.literal('function_call_output'),
  call_id: z.string(),
  output: z.string(),
})

const OpenAIReasoningPart = z.object({
  type: z.literal('reasoning'),
  id: z.string().optional(),
  encrypted_content: z.string().optional(),
  summary: z.array(z.any()).optional(),
  content: z.string().optional(),
})

const OpenAIContentPart = z.discriminatedUnion('type', [
  OpenAIInputTextPart,
  OpenAIOutputTextPart,
  OpenAIFunctionCallPart,
  OpenAIFunctionCallOutputPart,
  OpenAIReasoningPart,
])

const OpenAIMessage = z.object({
  type: z.literal('message'),
  id: z.string().optional(),
  role: z.enum(['user', 'assistant', 'system']),
  status: z.string().optional(),
  content: z.union([z.string(), z.array(OpenAIContentPart), z.null()]),
})

// Standalone reasoning item (can appear in input array)
const OpenAIReasoningItem = z.object({
  type: z.literal('reasoning'),
  id: z.string().optional(),
  encrypted_content: z.string().optional(),
  summary: z.array(z.any()).optional(),
  content: z.union([z.string(), z.null()]).optional(),
})

const OpenAIInputItem = z.union([
  OpenAIMessage,
  OpenAIReasoningItem,
  OpenAIFunctionCallPart,
  OpenAIFunctionCallOutputPart,
  z.string(), // Simple text input
])

const OpenAIFunctionDef = z.object({
  type: z.enum(['function', 'custom']),
  name: z.string(),
  description: z.string().optional(),
  parameters: z.record(z.string(), z.any()).optional(),
})

export const OpenAIResponsesWireSchema = z.object({
  model: z.string().optional(),
  input: z.union([z.string(), z.array(OpenAIInputItem)]).optional(),
  instructions: z.string().optional(),
  tools: z.array(OpenAIFunctionDef).optional(),
  metadata: z.unknown().optional(),
  max_output_tokens: z.number().optional(),
  stream: z.boolean().optional(),
  temperature: z.number().nullable().optional(),
  previous_response_id: z.string().optional(),
  conversation: z
    .union([
      z.string(),
      z.object({
        id: z.string(),
      }),
    ])
    .optional(),
})

export type OpenAIResponsesWire = z.infer<typeof OpenAIResponsesWireSchema>

export function openaiToModel(
  payloadUnknown: unknown,
  responseUnknown?: unknown
): ConversationModel {
  const payload = OpenAIResponsesWireSchema.parse(payloadUnknown)

  const out: ModelMessage[] = []

  // Track tool calls by ID for name resolution
  const toolCallMap = new Map<string, string>() // toolCallId -> toolName

  // Extract model names and usage
  const models: { request: string; response?: string } = {
    request: payload.model || 'unknown',
  }
  let usage: { inputTokens: number; outputTokens: number } | undefined

  // 1) Instructions as system message
  if (payload.instructions) {
    out.push({
      role: 'system',
      content: payload.instructions,
      providerOptions: { originalMessageGroup: '-1' },
    } as unknown as ModelMessage)
  }

  // 2) Process input items
  if (payload.input) {
    const inputs = Array.isArray(payload.input) ? payload.input : [payload.input]

    for (let i = 0; i < inputs.length; i++) {
      const item = inputs[i]

      if (typeof item === 'string') {
        // Simple text input
        out.push({
          role: 'user',
          content: item,
          providerOptions: { originalMessageGroup: String(i) },
        } as unknown as ModelMessage)
      } else if (typeof item === 'object' && item.type === 'reasoning') {
        // Standalone reasoning item in input - skip or add as user context
        // For now, we'll skip it as it's typically from the model
        continue
      } else if (typeof item === 'object' && item.type === 'function_call') {
        // Standalone function call in input - convert to assistant message with tool call
        const funcCall = item as z.infer<typeof OpenAIFunctionCallPart>
        const toolCallId = funcCall.id || funcCall.call_id || `tool-${Date.now()}`
        toolCallMap.set(toolCallId, funcCall.name)
        out.push({
          role: 'assistant',
          content: [
            {
              type: 'tool-call' as const,
              toolCallId,
              toolName: funcCall.name,
              args: JSON.parse(funcCall.arguments || '{}'),
            },
          ],
          providerOptions: { originalMessageGroup: String(i) },
        } as unknown as ModelMessage)
      } else if (typeof item === 'object' && item.type === 'function_call_output') {
        // Standalone function call output in input - convert to tool result message
        const funcOutput = item as z.infer<typeof OpenAIFunctionCallOutputPart>
        const toolName = toolCallMap.get(funcOutput.call_id) || 'unknown'
        out.push({
          role: 'tool',
          content: [
            {
              type: 'tool-result' as const,
              toolCallId: funcOutput.call_id,
              toolName,
              result: funcOutput.output,
            },
          ],
          providerOptions: { originalMessageGroup: String(i) },
        } as unknown as ModelMessage)
      } else if (typeof item === 'object' && item.type === 'message') {
        const msg = item as z.infer<typeof OpenAIMessage>

        if (msg.role === 'system') {
          const content =
            typeof msg.content === 'string'
              ? msg.content
              : msg.content === null
                ? ''
                : msg.content
                    .filter(p => p.type === 'input_text')
                    .map((p: any) => p.text)
                    .join('\n')

          if (content) {
            out.push({
              role: 'system',
              content,
              providerOptions: { originalMessageGroup: String(i) },
            } as unknown as ModelMessage)
          }
        } else if (msg.role === 'user') {
          if (msg.content === null) {
            // Skip messages with null content
            continue
          } else if (typeof msg.content === 'string') {
            out.push({
              role: 'user',
              content: msg.content,
              providerOptions: { originalMessageGroup: String(i) },
            } as unknown as ModelMessage)
          } else {
            const textParts = msg.content.filter(
              p => p.type === 'input_text'
            ) as z.infer<typeof OpenAIInputTextPart>[]

            if (textParts.length > 0) {
              const content =
                textParts.length === 1
                  ? textParts[0].text
                  : textParts.map(tp => ({ type: 'text' as const, text: tp.text }))

              out.push({
                role: 'user',
                content,
                providerOptions: { originalMessageGroup: String(i) },
              } as unknown as ModelMessage)
            }
          }
        } else if (msg.role === 'assistant') {
          // Process assistant message from input
          const assistantContent: any[] = []

          if (msg.content === null) {
            // Skip assistant messages with null content
            continue
          } else if (typeof msg.content === 'string') {
            assistantContent.push({ type: 'text' as const, text: msg.content })
          } else {
            for (const part of msg.content) {
              if (part.type === 'output_text') {
                assistantContent.push({
                  type: 'text' as const,
                  text: part.text,
                })
              } else if (part.type === 'function_call') {
                const toolCallId = part.id || part.call_id || `tool-${Date.now()}`
                toolCallMap.set(toolCallId, part.name)
                assistantContent.push({
                  type: 'tool-call' as const,
                  toolCallId,
                  toolName: part.name,
                  args: JSON.parse(part.arguments),
                })
              } else if (part.type === 'reasoning') {
                const reasoningText = part.content || '[Reasoning (encrypted)]'
                assistantContent.push({
                  type: 'text' as const,
                  text: `[Reasoning]\n${reasoningText}`,
                })
              }
            }
          }

          if (assistantContent.length > 0) {
            out.push({
              role: 'assistant',
              content: assistantContent,
              providerOptions: { originalMessageGroup: String(i) },
            } as unknown as ModelMessage)
          }
        }
      }
    }
  }

  // 3) Process response if provided
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

    // Process output array
    if (response.output && Array.isArray(response.output)) {
      const assistantContent: any[] = []

      // Collect all output items into a single assistant message
      for (const item of response.output) {
        if (item.type === 'message' && item.role === 'assistant') {
          // Handle message-wrapped content
          if (typeof item.content === 'string') {
            assistantContent.push({ type: 'text' as const, text: item.content })
          } else if (Array.isArray(item.content)) {
            for (const part of item.content) {
              if (part.type === 'output_text') {
                assistantContent.push({
                  type: 'text' as const,
                  text: part.text || '',
                })
              } else if (part.type === 'function_call') {
                const toolCallId = part.id || part.call_id || `tool-${Date.now()}`
                toolCallMap.set(toolCallId, part.name)
                assistantContent.push({
                  type: 'tool-call' as const,
                  toolCallId,
                  toolName: part.name,
                  args: JSON.parse(part.arguments || '{}'),
                })
              } else if (part.type === 'reasoning') {
                const reasoningText = part.content || '[Reasoning (encrypted)]'
                assistantContent.push({
                  type: 'text' as const,
                  text: `[Reasoning]\n${reasoningText}`,
                })
              }
            }
          }
        } else if (item.type === 'reasoning') {
          // Direct reasoning item (not wrapped in message)
          const reasoningText = item.content || '[Reasoning (encrypted)]'
          assistantContent.push({
            type: 'text' as const,
            text: `[Reasoning]\n${reasoningText}`,
          })
        } else if (item.type === 'function_call') {
          // Direct function call item (not wrapped in message)
          const toolCallId = item.id || item.call_id || `tool-${Date.now()}`
          toolCallMap.set(toolCallId, item.name)
          assistantContent.push({
            type: 'tool-call' as const,
            toolCallId,
            toolName: item.name,
            args: JSON.parse(item.arguments || '{}'),
          })
        }
      }

      if (assistantContent.length > 0) {
        const messageIndex = payload.input
          ? Array.isArray(payload.input)
            ? payload.input.length
            : 1
          : 0

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
        inputSchema: t.parameters || {}, // AI SDK uses 'inputSchema'
      }) as Tool
  )

  return {
    modelMessages: out,
    models,
    usage,
    tools,
    meta: {
      model: payload.model || models.response || 'unknown',
      maxTokens: payload.max_output_tokens,
      stream: payload.stream,
      metadata: payload.metadata,
    },
  }
}

/**
 * Parser for OpenAI Responses API format
 */
export class OpenAIResponsesParser implements ProviderParser {
  getParserName(): string {
    return 'openai-responses'
  }

  createConversation(
    payloadUnknown: unknown | null,
    responseUnknown?: unknown
  ): ConversationModel | undefined {
      if (payloadUnknown === null && responseUnknown) {
        // When payload is null, create minimal conversation from response only
        return this.responseToModel(responseUnknown)
      }
      return openaiToModel(payloadUnknown, responseUnknown)
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

    // Process output array
    if (response.output && Array.isArray(response.output)) {
      for (const item of response.output) {
        if (item.type === 'message' && item.role === 'assistant') {
          const assistantContent: any[] = []

          if (typeof item.content === 'string') {
            assistantContent.push({ type: 'text' as const, text: item.content })
          } else if (Array.isArray(item.content)) {
            for (const part of item.content) {
              if (part.type === 'output_text') {
                assistantContent.push({
                  type: 'text' as const,
                  text: part.text || '',
                })
              } else if (part.type === 'function_call') {
                const toolCallId = part.id || part.call_id || `tool-${Date.now()}`
                assistantContent.push({
                  type: 'tool-call' as const,
                  toolCallId,
                  toolName: part.name,
                  args: JSON.parse(part.arguments || '{}'),
                })
              } else if (part.type === 'reasoning') {
                const reasoningText = part.content || '[Reasoning (encrypted)]'
                assistantContent.push({
                  type: 'text' as const,
                  text: `[Reasoning]\n${reasoningText}`,
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
    // Convert ConversationModel back to OpenAI Responses format
    const lastMessage =
      conversation.modelMessages[conversation.modelMessages.length - 1]

    if (!lastMessage || lastMessage.role !== 'assistant') {
      // Return a minimal assistant response
      return {
        id: `resp_${Date.now()}`,
        object: 'response',
        created_at: Math.floor(Date.now() / 1000),
        status: 'completed',
        model: conversation.meta.model,
        output: [
          {
            type: 'message',
            id: `msg_${Date.now()}`,
            status: 'completed',
            role: 'assistant',
            content: [{ type: 'output_text', text: '', annotations: [] }],
          },
        ],
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
        },
      }
    }

    const content: any[] = []

    if (Array.isArray(lastMessage.content)) {
      for (const part of lastMessage.content) {
        if (part.type === 'text') {
          content.push({ type: 'output_text', text: part.text, annotations: [] })
        } else if (part.type === 'tool-call') {
          content.push({
            type: 'function_call',
            id: part.toolCallId,
            name: part.toolName,
            arguments: JSON.stringify((part as any).args),
          })
        }
      }
    } else if (typeof lastMessage.content === 'string') {
      content.push({
        type: 'output_text',
        text: lastMessage.content,
        annotations: [],
      })
    }

    return {
      id: `resp_${Date.now()}`,
      object: 'response',
      created_at: Math.floor(Date.now() / 1000),
      status: 'completed',
      model: conversation.meta.model,
      output: [
        {
          type: 'message',
          id: `msg_${Date.now()}`,
          status: 'completed',
          role: 'assistant',
          content,
        },
      ],
      usage: {
        input_tokens: conversation.usage?.inputTokens || 0,
        output_tokens: conversation.usage?.outputTokens || 0,
        total_tokens:
          (conversation.usage?.inputTokens || 0) +
          (conversation.usage?.outputTokens || 0),
      },
    }
  }

  getJsonFromSSE(events: SSEEvent[]): any | undefined {
    if (events.length === 0) return undefined

    let response: any = null
    const outputItems: any[] = []

    for (const event of events) {
      const data = event.data

      // Skip raw string events
      if (data?.raw) continue

      if (data?.type === 'response.created' && data.response) {
        response = data.response
      } else if (data?.type === 'response.in_progress' && data.response) {
        // Update response with in-progress data
        if (response) {
          Object.assign(response, data.response)
        } else {
          response = data.response
        }
      } else if (data?.type === 'response.output.item.added' && data.item) {
        // New output item started
        const index = data.index ?? outputItems.length
        outputItems[index] = data.item
      } else if (data?.type === 'response.output.item.done' && data.item) {
        // Output item completed
        const index = data.index ?? outputItems.length - 1
        outputItems[index] = data.item
      } else if (
        data?.type === 'response.content_part.added' &&
        data.content_part
      ) {
        // New content part in an item
        const itemIndex = data.item_index ?? outputItems.length - 1
        if (outputItems[itemIndex]) {
          if (!outputItems[itemIndex].content) {
            outputItems[itemIndex].content = []
          }
          const contentIndex = data.content_index ?? outputItems[itemIndex].content.length
          outputItems[itemIndex].content[contentIndex] = data.content_part
        }
      } else if (data?.type === 'response.content_part.done' && data.content_part) {
        // Content part completed
        const itemIndex = data.item_index ?? outputItems.length - 1
        if (outputItems[itemIndex]) {
          const contentIndex = data.content_index ?? outputItems[itemIndex].content.length - 1
          outputItems[itemIndex].content[contentIndex] = data.content_part
        }
      } else if (data?.type === 'response.output_text.delta' && data.delta) {
        // Text delta
        const itemIndex = data.item_index ?? outputItems.length - 1
        const contentIndex = data.content_index ?? 0
        if (outputItems[itemIndex]?.content?.[contentIndex]) {
          const part = outputItems[itemIndex].content[contentIndex]
          part.text = (part.text || '') + data.delta
        }
      } else if (data?.type === 'response.completed' && data.response) {
        // Final response with all data
        response = data.response
      }
    }

    if (response) {
      // Merge output items if we collected them separately
      if (outputItems.length > 0 && !response.output) {
        response.output = outputItems.filter(item => item !== undefined)
      }
    }

    return response
  }

  getUsage(usage: any): Usage | null {
    if (!usage) return null

    // OpenAI uses both input_tokens/output_tokens (newer) and prompt_tokens/completion_tokens (older)
    const inputTokens = Number(usage.input_tokens || usage.prompt_tokens || 0)
    const outputTokens = Number(usage.output_tokens || usage.completion_tokens || 0)

    // OpenAI may have cached tokens in various formats
    const cacheReadTokens = Number(usage.cached_tokens || 0)

    return {
      inputTokens,
      outputTokens,
      cacheReadTokens: cacheReadTokens > 0 ? cacheReadTokens : undefined,
    }
  }
}
