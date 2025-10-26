export interface KeyModel {
  id: string
  hashed: boolean
  hint: string
}

/**
 * Creates a hint for a key
 * - If hashed: "(hashed)"
 * - If not hashed: "sk_...xxx" where total length matches the key length
 */
export function createKeyHint(key: string, hashed: boolean): string {
  if (hashed) {
    return '(hashed)'
  }

  if (key.length <= 6) {
    // If key is too short, just show dots
    return '•'.repeat(key.length)
  }

  const first3 = key.substring(0, 3)
  const last3 = key.substring(key.length - 3)
  const middleLength = key.length - 6
  const middle = '•'.repeat(middleLength)

  return `${first3}${middle}${last3}`
}

/**
 * Converts a database key record to a KeyModel
 */
export function toKeyModel(dbKey: {
  id: string
  key: string
  hashed: boolean
}): KeyModel {
  return {
    id: dbKey.id,
    hashed: dbKey.hashed,
    hint: createKeyHint(dbKey.key, dbKey.hashed),
  }
}
