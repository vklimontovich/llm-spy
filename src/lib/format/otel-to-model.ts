import type { ModelMessage, Tool } from 'ai'
import type { ConversationModel } from './model'
import type { ParsedSpan } from './otel-types'

// Transform OTEL spans to ConversationModel for display
export function otelSpansToModel(spans: ParsedSpan[]): ConversationModel {
  const modelMessages: ModelMessage[] = []
  let tools: Tool[] = []
  let model = ''
  const metadata: unknown = undefined

  // Collect messages and tools from all spans
  for (const span of spans) {
    // Extract model info if available
    if (!model) {
      model = span.gen_ai?.request?.model || span.llm?.request?.model || ''
    }

    // Extract tools/functions from first span that has them
    if (tools.length === 0) {
      // Check in gen_ai attributes
      if (
        span.gen_ai?.request?.functions &&
        Array.isArray(span.gen_ai.request.functions)
      ) {
        tools = span.gen_ai.request.functions.map(
          f =>
            ({
              name: f.name,
              description: f.description,
              inputSchema: f.parameters || {},
            }) as Tool
        )
      }
      // Check in llm.request.functions if not found in gen_ai
      else if (
        span.llm?.request?.functions &&
        Array.isArray(span.llm.request.functions)
      ) {
        tools = span.llm.request.functions.map(
          f =>
            ({
              name: f.name,
              description: f.description,
              inputSchema: f.parameters || {},
            }) as Tool
        )
      }
    }

    // Extract system message from gen_ai
    if (span.gen_ai?.system) {
      modelMessages.push({
        role: 'system',
        content: span.gen_ai.system,
      } as ModelMessage)
    }

    // Extract prompts from gen_ai attributes
    if (span.gen_ai?.prompt && Array.isArray(span.gen_ai.prompt)) {
      for (const prompt of span.gen_ai.prompt) {
        const role =
          prompt.role === 'tool'
            ? 'tool'
            : (prompt.role as 'system' | 'user' | 'assistant' | 'tool')

        // Check if this prompt has tool_calls (assistant with tool calls)
        if (
          prompt.tool_calls &&
          Array.isArray(prompt.tool_calls) &&
          role === 'assistant'
        ) {
          const parts: any[] = []

          // Add content if present
          if (prompt.content) {
            parts.push({ type: 'text', text: prompt.content })
          }

          // Add tool calls
          for (const tc of prompt.tool_calls) {
            parts.push({
              type: 'tool-call',
              toolCallId: tc.id,
              toolName: tc.name,
              args: tc.arguments,
            })
          }

          modelMessages.push({
            role: 'assistant',
            content: parts,
          } as ModelMessage)
        } else if (role === 'tool') {
          // Tool result message
          modelMessages.push({
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'unknown',
                toolName: 'unknown',
                output: { value: prompt.content || '' },
              },
            ],
          } as ModelMessage)
        } else {
          // Regular text message (user or system)
          modelMessages.push({
            role: role as any,
            content: prompt.content || '',
          } as ModelMessage)
        }
      }
    }

    // Extract completions from gen_ai attributes
    if (span.gen_ai?.completion && Array.isArray(span.gen_ai.completion)) {
      for (const completion of span.gen_ai.completion) {
        // Check if this completion has tool_calls
        if (completion.tool_calls && Array.isArray(completion.tool_calls)) {
          const parts: any[] = []

          // Add content if present
          if (completion.content) {
            parts.push({ type: 'text', text: completion.content })
          }

          // Add tool calls
          for (const tc of completion.tool_calls) {
            parts.push({
              type: 'tool-call',
              toolCallId: tc.id,
              toolName: tc.name,
              args: tc.arguments,
            })
          }

          modelMessages.push({
            role: 'assistant',
            content: parts,
          } as ModelMessage)
        } else if (completion.content) {
          // Regular completion content
          modelMessages.push({
            role: 'assistant',
            content: [{ type: 'text', text: completion.content }],
          } as ModelMessage)
        }
      }
    }

    // Extract prompts from llm attributes
    if (span.llm?.prompt && Array.isArray(span.llm.prompt)) {
      for (const prompt of span.llm.prompt) {
        const role =
          prompt.role === 'tool'
            ? 'tool'
            : (prompt.role as 'system' | 'user' | 'assistant' | 'tool')

        // Handle tool calls (assistant with tool calls)
        if (
          prompt.tool_calls &&
          Array.isArray(prompt.tool_calls) &&
          role === 'assistant'
        ) {
          const parts: any[] = []

          // Add content if present
          if (prompt.content) {
            parts.push({ type: 'text', text: prompt.content })
          }

          // Add tool calls
          for (const tc of prompt.tool_calls) {
            parts.push({
              type: 'tool-call',
              toolCallId: tc.id,
              toolName: tc.name,
              args: tc.arguments,
            })
          }

          modelMessages.push({
            role: 'assistant',
            content: parts,
          } as ModelMessage)
        } else if (role === 'tool') {
          // Tool result message
          modelMessages.push({
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'unknown',
                toolName: 'unknown',
                output: { value: prompt.content || '' },
              },
            ],
          } as ModelMessage)
        } else {
          // Regular text message
          modelMessages.push({
            role: role as any,
            content: prompt.content || '',
          } as ModelMessage)
        }
      }
    }
  }

  return {
    modelMessages,
    tools,
    meta: {
      model,
      metadata,
    },
  }
}
