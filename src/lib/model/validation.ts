/**
 * Validates an upstream name to ensure it follows TypeScript variable naming rules
 * - Must start with a letter or underscore
 * - Can only contain letters, numbers, and underscores
 * - Cannot be empty
 */
export function validateUpstreamName(name: string): {
  valid: boolean
  error?: string
} {
  if (!name || name.trim().length === 0) {
    return {
      valid: false,
      error: 'Name is required',
    }
  }

  const trimmedName = name.trim()

  // Must start with letter or underscore
  if (!/^[a-zA-Z_]/.test(trimmedName)) {
    return {
      valid: false,
      error: 'Name must start with a letter or underscore',
    }
  }

  // Can only contain letters, numbers, and underscores
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmedName)) {
    return {
      valid: false,
      error: 'Name can only contain letters, numbers, and underscores',
    }
  }

  return { valid: true }
}
