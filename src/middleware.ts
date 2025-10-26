import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Add no-index headers for share endpoints
  if (
    pathname.startsWith('/share') ||
    (pathname.includes('/api/requests/') &&
      (pathname.includes('/public') || pathname.includes('/share')))
  ) {
    const response = NextResponse.next()

    // Multiple layers of protection against indexing
    response.headers.set(
      'X-Robots-Tag',
      'noindex, nofollow, noarchive, nosnippet, noimageindex'
    )

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/share/:path*',
    '/api/requests/:path*/public',
    '/api/requests/:path*/share',
  ],
}
