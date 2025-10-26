/**
 * Masks sensitive data in logs to prevent exposure of API keys, tokens, and secrets
 */
export function maskSensitiveData(text: string): string {
  let masked = text

  // Mask API keys with sk_, pk_, etc. prefixes
  masked = masked.replace(
    /\b(sk|pk|rk|api|key)_[a-zA-Z0-9_-]{16,}/gi,
    match => {
      const prefix = match.substring(0, match.indexOf('_') + 1)
      return `${prefix}[REDACTED]`
    }
  )

  // Mask Bearer tokens
  masked = masked.replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]')

  // Mask Authorization header values in JSON or plain text
  masked = masked.replace(
    /"authorization":\s*"[^"]+"/gi,
    '"authorization": "[REDACTED]"'
  )

  masked = masked.replace(
    /'authorization':\s*'[^']+'/gi,
    "'authorization': '[REDACTED]'"
  )

  // Mask common secret fields in JSON
  const secretFields = [
    'api_key',
    'apiKey',
    'secret',
    'password',
    'token',
    'access_token',
    'refresh_token',
    'client_secret',
    'private_key',
  ]

  secretFields.forEach(field => {
    // Double quotes
    const doubleQuoteRegex = new RegExp(`"${field}":\\s*"[^"]*"`, 'gi')
    masked = masked.replace(doubleQuoteRegex, `"${field}": "[REDACTED]"`)

    // Single quotes
    const singleQuoteRegex = new RegExp(`'${field}':\\s*'[^']*'`, 'gi')
    masked = masked.replace(singleQuoteRegex, `'${field}': '[REDACTED]'`)
  })

  // Mask AWS-style keys
  masked = masked.replace(/AKIA[0-9A-Z]{16}/g, 'AKIA[REDACTED]')

  // Mask JWT tokens (anything that looks like base64.base64.base64)
  masked = masked.replace(
    /\beyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\b/g,
    'eyJ[REDACTED_JWT]'
  )

  return masked
}
