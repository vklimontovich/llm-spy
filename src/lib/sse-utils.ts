import { createParser, type EventSourceMessage } from 'eventsource-parser'
import { AnthropicParser } from '@/lib/format'
import type { ProviderParser } from '@/lib/format'

/**
 * Represents a parsed SSE event - either JSON data or raw string
 */
export type SSEEvent = {
  /** The event type, if specified */
  event?: string
  /** The event ID, if specified */
  id?: string
  /** The parsed data (if JSON) or an object with raw data string */
  data: any | { raw: string }
}

/**
 * Parses raw SSE text into an array of events
 * @param raw - Raw SSE text with event stream format
 * @returns Array of parsed events with JSON data or raw strings
 */
export function parseSSEEvents(raw: string): SSEEvent[] {
  const events: SSEEvent[] = []

  const parser = createParser({
    onEvent(message: EventSourceMessage) {
      try {
        // Try to parse as JSON
        const jsonData = JSON.parse(message.data)
        events.push({
          event: message.event,
          id: message.id,
          data: jsonData,
        })
      } catch {
        // If not JSON, store raw data string
        events.push({
          event: message.event,
          id: message.id,
          data: { raw: message.data },
        })
      }
    },
    onError(error) {
      throw new Error('Failed to parse SSE events: ' + error.message, {
        cause: error,
      })
    },
  })

  parser.feed(raw)
  return events
}

/**
 * Attempts to reconstruct a complete response from SSE events
 * @param raw - Raw SSE text
 * @returns Reconstructed response object or array of events if format unknown
 */
export function reconstructSSEResponse(raw: string): any {
  const events = parseSSEEvents(raw)
  if (events.length === 0) return null

  // Try to detect format and get appropriate parser
  const parser = detectSSEFormat(events)
  if (parser) {
    const result = parser.parseSSE(events)
    if (result) return result
  }

  // Check if it's OpenAI format (not yet migrated to parser)
  const firstData = events[0]?.data
  if (firstData && !firstData.raw && firstData?.choices?.[0]) {
    return reconstructOpenAISSE(
      events.map(e => e.data).filter(d => d && !d.raw)
    )
  }

  // Return all events as-is if format unknown
  return events
}

/**
 * Detects the format of SSE events and returns the appropriate parser
 */
function detectSSEFormat(events: SSEEvent[]): ProviderParser | undefined {
  if (events.length === 0) return undefined

  const firstData = events[0]?.data
  if (!firstData || firstData.raw) return undefined

  // Check if it's Anthropic format
  if (firstData.type === 'message_start' && firstData.message) {
    return new AnthropicParser()
  }

  // Check for other Anthropic event types
  if (
    firstData.type === 'content_block_start' ||
    firstData.type === 'content_block_delta' ||
    firstData.type === 'message_delta'
  ) {
    return new AnthropicParser()
  }

  return undefined
}

/**
 * Reconstructs an OpenAI-style response from SSE events
 */
function reconstructOpenAISSE(eventData: any[]): any {
  let response: any = null

  for (const data of eventData) {
    if (data.choices?.[0]) {
      if (!response) {
        response = {
          id: data.id,
          object: data.object,
          created: data.created,
          model: data.model,
          choices: [
            {
              message: {
                role: 'assistant',
                content: '',
              },
              finish_reason: null,
            },
          ],
        }
      }

      const choice = data.choices[0]
      if (choice.delta?.content) {
        response.choices[0].message.content += choice.delta.content
      }
      if (choice.finish_reason) {
        response.choices[0].finish_reason = choice.finish_reason
      }
    }
  }

  return response
}

/**
 * Checks if a response is Server-Sent Events based on headers
 * @param headers - Response headers object
 * @returns true if content-type indicates SSE
 */
export function isSSEResponse(headers: Record<string, string> | null): boolean {
  if (!headers) return false
  const contentType = headers['content-type'] || ''
  return contentType.includes('text/event-stream')
}
