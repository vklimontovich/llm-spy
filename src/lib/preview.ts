import type { ModelMessage } from 'ai'

/**
 * Generate a human-readable preview of a model message
 * @param message The message to preview
 * @param maxLength Maximum length of the preview (default: 100)
 * @returns A preview string
 */
export function getPreview(message: ModelMessage | undefined, maxLength: number = 100): string {
  if (!message) {
    return ''
  }

  const parts: string[] = []

  if (typeof message.content === 'string') {
    // Simple string content
    parts.push(message.content)
  } else if (Array.isArray(message.content)) {
    // Array of content parts
    for (const part of message.content) {
      if (part.type === 'text') {
        parts.push(part.text)
      } else if (part.type === 'tool-call') {
        parts.push(`${part.toolName}()`)
      } else if (part.type === 'tool-result') {
        const resultStr = typeof part.output === 'string'
          ? part.output
          : JSON.stringify(part.output)
        parts.push(`${part.toolName}→${resultStr}`)
      } else if (part.type === 'image') {
        parts.push('[image]')
      } else if (part.type === 'file') {
        parts.push(`[file:${(part as any).filename || 'unknown'}]`)
      } else if (part.type === 'reasoning') {
        parts.push('[reasoning]')
      } else {
        // Fallback for unknown types
        parts.push(JSON.stringify(part))
      }
    }
  } else {
    // Fallback for other types
    parts.push(JSON.stringify(message.content))
  }

  const preview = parts.join(' ').trim()

  // Truncate to max length
  if (preview.length > maxLength) {
    return preview.substring(0, maxLength - 3) + '...'
  }

  return preview
}
