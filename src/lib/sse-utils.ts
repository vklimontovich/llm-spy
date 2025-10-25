import { createParser, type EventSourceMessage } from 'eventsource-parser'

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
 * Checks if a response is Server-Sent Events based on headers
 * @param headers - Response headers object
 * @returns true if content-type indicates SSE
 */
export function isSSEResponse(headers: Record<string, string> | null): boolean {
  if (!headers) return false
  const contentType = headers['content-type'] || ''
  return contentType.includes('text/event-stream')
}
