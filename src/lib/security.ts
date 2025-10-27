/**
 * Masks security-sensitive header values for storage and logging.
 * This helps prevent accidental exposure of API keys, tokens, and other credentials.
 * Masks based on:
 * - Header names containing 'auth', 'key', or 'token' (case-insensitive)
 * - Values containing JWTs, Bearer tokens, or other credential patterns
 * - IP addresses (when maskPII is enabled)
 */
export function maskSecurityValues(
  headers: Record<string, string>,
  opts: { maskPII: boolean } = { maskPII: false }
): Record<string, string> {
  const masked: Record<string, string> = {}

  // Patterns to detect sensitive values
  const jwtPattern = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g
  const bearerPattern = /Bearer\s+[A-Za-z0-9_\-\.]+/gi
  const ipPattern =
    /\b(?:\d{1,3}\.){3}\d{1,3}\b|(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase()
    let maskedValue = value

    // Check if header name contains sensitive keywords
    const hasSensitiveName =
      lowerKey.includes('auth') ||
      lowerKey.includes('key') ||
      lowerKey.includes('token')

    if (hasSensitiveName) {
      // Mask the entire value but keep first/last 4 chars if long enough
      if (value.length > 12) {
        const prefix = value.substring(0, 4)
        const suffix = value.substring(value.length - 4)
        maskedValue = `${prefix}***${suffix}`
      } else {
        maskedValue = '***'
      }
    } else {
      // Check value content for sensitive patterns

      // Mask JWTs in the value
      if (jwtPattern.test(value)) {
        maskedValue = value.replace(jwtPattern, match => {
          if (match.length > 12) {
            return `${match.substring(0, 4)}***${match.substring(match.length - 4)}`
          }
          return '***'
        })
      }

      // Mask Bearer tokens in the value
      if (bearerPattern.test(maskedValue)) {
        maskedValue = maskedValue.replace(bearerPattern, match => {
          const parts = match.split(/\s+/)
          if (parts.length === 2 && parts[1].length > 12) {
            return `${parts[0]} ${parts[1].substring(0, 4)}***${parts[1].substring(parts[1].length - 4)}`
          }
          return 'Bearer ***'
        })
      }

      // Mask IP addresses if PII masking is enabled
      if (opts.maskPII && ipPattern.test(maskedValue)) {
        maskedValue = maskedValue.replace(ipPattern, '*.*.*.*')
      }
    }

    masked[key] = maskedValue
  }

  return masked
}
