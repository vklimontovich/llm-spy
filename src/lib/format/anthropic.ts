import { z } from 'zod';
import type { Tool, ModelMessage } from 'ai';
import type { ConversationModel, ProviderParser } from '@/lib/format/model'
import type { SSEEvent } from '@/lib/sse-utils'

// ──────────────────────────────────────────────────────────
// Anthropic-specific Zod schemas
// ──────────────────────────────────────────────────────────

const AnthropicTextPart = z.object({
  type: z.literal('text'),
  text: z.string(),
});

const AnthropicToolUsePart = z.object({
  type: z.literal('tool_use'),
  id: z.string().optional(),
  name: z.string(),
  input: z.unknown(),
});

const AnthropicToolResultPart = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string(),
  content: z.unknown().optional(), // string | [{type:'text',text}] | any
  is_error: z.boolean().optional(),
});

const AnthropicContentPart = z.discriminatedUnion('type', [
  AnthropicTextPart,
  AnthropicToolUsePart,
  AnthropicToolResultPart,
  // add image/file parts here if needed
]);

const AnthropicMessage = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([
    z.string(),
    z.array(AnthropicContentPart)
  ]),
});

const AnthropicToolDef = z.object({
  name: z.string(),
  description: z.string().optional(),
  input_schema: z.record(z.string(), z.any()).optional(),
});

export const AnthropicWireSchema = z.object({
  model: z.string(),
  messages: z.array(AnthropicMessage),
  system: z.union([
    z.string(),
    z.array(z.object({
      type: z.literal('text'),
      text: z.string(),
      cache_control: z.object({
        type: z.string()
      }).optional()
    }))
  ]).optional(),
  tools: z.array(AnthropicToolDef).optional(),
  metadata: z.unknown().optional(),
  max_tokens: z.number().optional(),
  stream: z.boolean().optional(),
});

export type AnthropicWire = z.infer<typeof AnthropicWireSchema>;


export function anthropicToModel(payloadUnknown: unknown, responseUnknown?: unknown): ConversationModel {
  const payload = AnthropicWireSchema.parse(payloadUnknown);

  const out: ModelMessage[] = [];
  
  // Track tool calls by ID for name resolution
  const toolCallMap = new Map<string, string>(); // toolCallId -> toolName

  // 1) Top-level system - handle multiple system messages
  if (payload.system) {
    if (typeof payload.system === 'string') {
      // Single string system message
      out.push({
        role: 'system',
        content: payload.system,
        providerOptions: { originalMessageGroup: '-1' }
      } as unknown as ModelMessage);
    } else {
      // Array of system message parts - output each as separate system message
      for (const part of payload.system) {
        if (part.text.trim()) {
          out.push({
            role: 'system',
            content: part.text,
            providerOptions: {
              originalMessageGroup: '-1',
              ...(part.cache_control && { cache_control: part.cache_control })
            }
          } as unknown as ModelMessage);
        }
      }
    }
  }

  // 2) Messages
  for (let messageIndex = 0; messageIndex < payload.messages.length; messageIndex++) {
    const m = payload.messages[messageIndex];

    // Handle string content (common in user messages)
    if (typeof m.content === 'string') {
      if (m.role === 'user') {
        out.push({
          role: 'user',
          content: m.content,
          providerOptions: { originalMessageGroup: String(messageIndex) }
        } as unknown as ModelMessage);
      } else if (m.role === 'assistant') {
        out.push({
          role: 'assistant',
          content: [{ type: 'text', text: m.content }],
          providerOptions: { originalMessageGroup: String(messageIndex) }
        } as unknown as ModelMessage);
      }
      continue;
    }

    const parts = Array.isArray(m.content) ? m.content : [];

    // tool_result parts arrive on user turns → map to role:'tool'
    const toolResults = parts.filter(p => p.type === 'tool_result') as z.infer<typeof AnthropicToolResultPart>[];
    if (toolResults.length) {
      // Tool messages have a different content structure in AI SDK
      for (const tr of toolResults) {
        // Try to find the tool name from previous tool calls
        const toolName = toolCallMap.get(tr.tool_use_id) || 'unknown';
        
        out.push({
          role: 'tool',
          content: [{
            type: 'tool-result' as const,
            toolCallId: tr.tool_use_id,
            toolName,
            output: normalizeToolResult(tr.content),
          }],
          providerOptions: { originalMessageGroup: String(messageIndex) }
        } as unknown as ModelMessage);
      }
    }

    const textParts = parts.filter(p => p.type === 'text') as z.infer<typeof AnthropicTextPart>[];

    if (m.role === 'user') {
      if (textParts.length > 0) {
        const content =
          textParts.length === 1
            ? textParts[0].text // user content can be a string
            : textParts.map(tp => ({ type: 'text' as const, text: tp.text }));

        out.push({
          role: 'user',
          content,
          providerOptions: { originalMessageGroup: String(messageIndex) }
        } as unknown as ModelMessage);
      }
    } else {
      // assistant: enforce array-of-parts (no bare string) → fixes your type error
      const toolUses = parts.filter(p => p.type === 'tool_use') as z.infer<typeof AnthropicToolUsePart>[];

      const assistantContent: any[] = [
        ...textParts.map(tp => ({ type: 'text' as const, text: tp.text })),
        ...toolUses.map(tu => {
          const toolCallId = tu.id || `tool-${Date.now()}`;
          // Store the mapping for later tool results
          if (tu.id) {
            toolCallMap.set(tu.id, tu.name);
          }
          return {
            type: 'tool-call' as const,
            toolCallId,
            toolName: tu.name,
            args: tu.input,
          };
        }),
      ];

      if (assistantContent.length > 0) {
        out.push({
          role: 'assistant',
          content: assistantContent,
          providerOptions: { originalMessageGroup: String(messageIndex) }
        } as unknown as ModelMessage);
      }
    }
  }

  // 3) Add response if provided
  if (responseUnknown && typeof responseUnknown === 'object') {
    const response = responseUnknown as any

    // Check if this is an Anthropic assistant message
    if (response.role === 'assistant' && response.content) {
      const assistantContent: any[] = []
      const messageIndex = payload.messages.length // Use next index for response

      if (typeof response.content === 'string') {
        assistantContent.push({ type: 'text' as const, text: response.content })
      } else if (Array.isArray(response.content)) {
        for (const part of response.content) {
          if (part.type === 'text') {
            assistantContent.push({ type: 'text' as const, text: part.text || '' })
          } else if (part.type === 'tool_use') {
            const toolCallId = part.id || `tool-${Date.now()}`;
            // Store the mapping for later tool results
            if (part.id) {
              toolCallMap.set(part.id, part.name);
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
          providerOptions: { originalMessageGroup: String(messageIndex) }
        } as unknown as ModelMessage)
      }
    }
  }

  // 4) Tools: map to SDK Tool type (no Zod)
  const tools: Tool[] = (payload.tools ?? []).map<Tool>(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.input_schema || {}, // AI SDK uses 'inputSchema'
  } as Tool));

  return {
    modelMessages: out,
    tools,
    meta: {
      model: payload.model,
      maxTokens: payload.max_tokens,
      stream: payload.stream,
      metadata: payload.metadata,
    },
  };
}

function normalizeToolResult(raw: unknown): unknown {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    const text = raw
      .map(p => (p && typeof p === 'object' && (p as any).type === 'text' ? String((p as any).text ?? '') : ''))
      .filter(Boolean)
      .join('\n');
    if (text) return text;
  }
  return raw ?? null;
}

/**
 * Parser for Anthropic API format
 */
export class AnthropicParser implements ProviderParser {

  getParserName(): string {
    return 'anthropic';
  }

  createConversation(payloadUnknown: unknown, responseUnknown?: unknown): ConversationModel | undefined {
    try {
      return anthropicToModel(payloadUnknown, responseUnknown);
    } catch (error) {
      console.error('Failed to parse Anthropic conversation:', error);
      return undefined;
    }
  }

  parseSSE(events: SSEEvent[]): any | undefined {
    if (events.length === 0) return undefined;

    let response: any = null;
    const contentParts: any[] = [];

    for (const event of events) {
      const data = event.data;

      // Skip raw string events
      if (data?.raw) continue;

      if (data?.type === 'message_start' && data.message) {
        response = data.message;
      } else if (data?.type === 'content_block_start' && data.content_block) {
        const index = data.index ?? contentParts.length;
        contentParts[index] = data.content_block;
      } else if (data?.type === 'content_block_delta' && data.delta) {
        const index = data.index ?? contentParts.length - 1;
        if (contentParts[index]) {
          if (data.delta.type === 'text_delta') {
            contentParts[index].text = (contentParts[index].text || '') + data.delta.text;
          } else if (data.delta.type === 'input_json_delta') {
            contentParts[index].input = (contentParts[index].input || '') + data.delta.partial_json;
          }
        }
      } else if (data?.type === 'message_delta' && data.delta) {
        if (response) {
          if (data.delta.stop_reason) response.stop_reason = data.delta.stop_reason;
          if (data.usage) response.usage = data.usage;
        }
      }
    }

    if (response && contentParts.length > 0) {
      response.content = contentParts.filter(p => p !== undefined);
    }

    return response;
  }
}