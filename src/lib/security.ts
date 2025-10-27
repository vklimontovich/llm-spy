/**
 * Masks security-sensitive header values for storage and logging.
 * This helps prevent accidental exposure of API keys, tokens, and other credentials.
 * Masks any header name containing 'auth' or 'key' (case-insensitive).
 */
export function maskSecurityValues(
  headers: Record<string, string>
): Record<string, string> {
  const masked: Record<string, string> = {}

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase()
    // Check if header name contains 'auth' or 'key'
    if (lowerKey.includes('auth') || lowerKey.includes('key')) {
      // Mask the value but keep first/last 4 chars if long enough
      if (value.length > 12) {
        const prefix = value.substring(0, 4)
        const suffix = value.substring(value.length - 4)
        masked[key] = `${prefix}***[redacted]***${suffix}`
      } else {
        masked[key] = '***[redacted]***'
      }
    } else {
      masked[key] = value
    }
  }

  return masked
}
