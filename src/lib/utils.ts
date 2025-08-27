function trimEnd(str: string, char: string): string {
  return str.endsWith(char) ? str.slice(0, -1) : str
}

export function getCurrentOrigin(path?: string): string {
  // Check for environment variable first (available on client side with NEXT_PUBLIC_ prefix)
  if (process.env.NEXT_PUBLIC_ORIGIN) {
    return trimEnd(process.env.NEXT_PUBLIC_ORIGIN, '/') + (path || '')
  }

  // Client-side version using window.location
  if (typeof window !== 'undefined') {
    const { protocol, host } = window.location
    return `${protocol}//${host}${path || ''}`
  }

  // Fallback for SSR
  return `http://localhost:3000${path || ''}`
}

// Server-side version for API routes and server components
export async function getOriginFromHeaders(path?: string): Promise<string> {
  // Check for environment variable first
  if (process.env.NEXT_PUBLIC_ORIGIN) {
    return trimEnd(process.env.NEXT_PUBLIC_ORIGIN, '/') + (path || '')
  }

  try {
    const { headers } = await import('next/headers')
    const headersList = await headers()

    // Check for forwarded headers (common in proxy/load balancer setups)
    const forwardedProto = headersList.get('x-forwarded-proto')
    const forwardedHost = headersList.get('x-forwarded-host')
    const forwardedPort = headersList.get('x-forwarded-port')

    // Determine protocol
    const protocol =
      forwardedProto ||
      (process.env.NODE_ENV === 'production' ? 'https' : 'http')

    // Determine host
    const host = forwardedHost || headersList.get('host') || 'localhost:3000'

    // Handle port
    let port = ''
    if (forwardedPort && !host.includes(':')) {
      const portNum = parseInt(forwardedPort, 10)
      // Don't include standard ports
      if (
        !(
          (protocol === 'https' && portNum === 443) ||
          (protocol === 'http' && portNum === 80)
        )
      ) {
        port = `:${forwardedPort}`
      }
    }

    return `${protocol}://${host}${port}${path || ''}`
  } catch {
    // Fallback for when headers() can't be called
    console.warn('Could not determine origin from headers, using fallback')
    return `http://localhost:3000${path || ''}`
  }
}
