/**
 * Extracts session ID from request headers
 * Currently uses sentry-trace header, but can be easily modified to use other headers
 */
export function extractSessionId(headers: any): string | null {
  if (!headers || typeof headers !== 'object') return null

  // Extract from sentry-trace header
  // Format: {trace_id}-{parent_span_id}-{sampled}
  const sentryTrace = headers['sentry-trace']
  if (sentryTrace) {
    // Use the trace_id part as session ID
    const parts = sentryTrace.split('-')
    if (parts.length > 0 && parts[0]) {
      return parts[0]
    }
  }

  // Add other header extraction logic here as needed
  // For example:
  // - X-Request-ID
  // - X-Correlation-ID
  // - X-Session-ID

  return null
}

/**
 * Groups requests by session ID
 */
export function groupRequestsBySession<T extends { requestHeaders: any }>(
  requests: T[]
): Map<string | null, T[]> {
  const sessionMap = new Map<string | null, T[]>()

  for (const request of requests) {
    const sessionId = extractSessionId(request.requestHeaders)
    const existing = sessionMap.get(sessionId) || []
    existing.push(request)
    sessionMap.set(sessionId, existing)
  }

  return sessionMap
}
