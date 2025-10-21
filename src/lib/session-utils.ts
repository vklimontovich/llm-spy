import { createHash } from 'crypto'

// Base62 encode from bytes without BigInt (ES2019-compatible)
function base62Encode(bytes: Uint8Array, alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'): string {
  if (bytes.length === 0) return ''
  const base = 62
  // Count leading zeros
  let zeros = 0
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++

  // Convert base-256 bytes to base-62 digits
  const digits: number[] = []
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i]
    for (let j = 0; j < digits.length; j++) {
      carry += (digits[j] << 8) >>> 0
      digits[j] = carry % base
      carry = (carry / base) | 0
    }
    while (carry > 0) {
      digits.push(carry % base)
      carry = (carry / base) | 0
    }
  }

  // Compose string: leading zeros map to first alphabet char
  let out = ''
  for (let i = 0; i < zeros; i++) out += alphabet[0]
  for (let i = digits.length - 1; i >= 0; i--) out += alphabet[digits[i]]
  return out || alphabet[0]
}

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

// Small LRU-ish cache to avoid re-hashing repeated trace IDs

function hash(str: string) {
  const hasher = createHash('sha256')
  const digest = hasher.update(str).digest()
  // Take first 8 bytes (64 bits), encode base62; left-pad to 11 chars
  const id = base62Encode(digest.subarray(0, 8), ALPHABET)
  return id.padStart(11, ALPHABET[0])
}

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
      return hash(parts[0])
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
  requests: T[],
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
