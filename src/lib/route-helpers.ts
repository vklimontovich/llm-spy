import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod/v4'
import { gunzip, inflate, brotliDecompress } from 'zlib'
import { promisify } from 'util'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { serverEnv } from '@/lib/server-env'
import { maskSensitiveData } from '@/lib/log-masking'

const gunzipAsync = promisify(gunzip)
const inflateAsync = promisify(inflate)
const brotliDecompressAsync = promisify(brotliDecompress)

/**
 * Gets the origin URL from the current request
 * Checks in order: NEXT_PUBLIC_ORIGIN env var, request headers, fallback
 * @returns The origin URL (e.g., "https://example.com" or "http://localhost:3000")
 */
export async function getOrigin(): Promise<string> {
  // First check environment variable
  const configuredOrigin = serverEnv.NEXT_PUBLIC_ORIGIN || serverEnv.APP_ORIGIN
  if (configuredOrigin) {
    const origin = configuredOrigin.trim()
    return origin.endsWith('/') ? origin.slice(0, -1) : origin
  }

  try {
    const headersList = await headers()

    // Check for forwarded headers (common in proxy/load balancer setups)
    const forwardedProto = headersList.get('x-forwarded-proto')
    const forwardedHost = headersList.get('x-forwarded-host')
    const forwardedPort = headersList.get('x-forwarded-port')

    // Determine protocol
    const protocol =
      forwardedProto || (serverEnv.NODE_ENV === 'production' ? 'https' : 'http')

    // Determine host
    const host = forwardedHost || headersList.get('host') || 'localhost:3000'

    // Handle port - only include if it's not a standard port
    let port = ''
    if (forwardedPort && !host.includes(':')) {
      const portNum = parseInt(forwardedPort, 10)
      // Don't include standard ports (80 for http, 443 for https)
      if (
        !(
          (protocol === 'https' && portNum === 443) ||
          (protocol === 'http' && portNum === 80)
        )
      ) {
        port = `:${forwardedPort}`
      }
    }

    return `${protocol}://${host}${port}`
  } catch (error) {
    console.warn(
      'Could not determine origin from headers, using fallback:',
      error
    )
    return 'http://localhost:3000'
  }
}

type RouteHandler = (
  request: NextRequest,
  ...other: any[]
) => Promise<Response | any>

export class HttpError extends Error {
  status: number
  cause?: unknown

  constructor(
    status: number,
    message?: string,
    { cause }: { cause?: unknown } = {}
  ) {
    super(message, cause ? { cause } : undefined)
    this.status = status
    this.name = 'HttpError'
    this.cause = cause
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export function withError(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, ...args: any[]) => {
    try {
      const result = await handler(request, ...args)
      if (result instanceof Response) {
        return result
      } else if (result === undefined) {
        return new Response(null, { status: 204 }) // No Content
      } else {
        return NextResponse.json(result, { status: 200 }) // Return JSON response
      }
    } catch (error) {
      console.error('Route error:', error)
      if (error instanceof HttpError) {
        return NextResponse.json(
          {
            error: error.message || 'An error occurred',
            details: error.cause ? String(error.cause) : undefined,
          },
          { status: error.status }
        )
      } else if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid request - zod error',
            issues: error.issues,
          },
          { status: 400 }
        )
      }
      return NextResponse.json(
        {
          error: 'Internal server error',
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      )
    }
  }
}

export async function decompressResponse(
  responseBody: ArrayBuffer,
  contentEncoding: string | null
): Promise<Buffer> {
  const buffer = Buffer.from(responseBody)

  if (!contentEncoding) {
    return buffer
  }

  try {
    switch (contentEncoding.toLowerCase()) {
      case 'gzip':
        return await gunzipAsync(buffer)
      case 'deflate':
        return await inflateAsync(buffer)
      case 'br':
      case 'brotli':
        return await brotliDecompressAsync(buffer)
      default:
        console.warn(`Unknown compression format: ${contentEncoding}`)
        return buffer
    }
  } catch (error) {
    console.error(`Failed to decompress ${contentEncoding}:`, error)
    return buffer
  }
}

const AUTH_HEADERS = ['x-monitor-auth', 'x-llmspy-auth', 'x-proxy-auth']
export const authGetParams = '__llmspy_auth_key'

/**
 * Extracts auth key from request headers or query params
 * Returns the full key string (may include upstream prefix like "upstream.key")
 */
export function getAuthKey(request: NextRequest): string | undefined {
  let authHeader = AUTH_HEADERS.map(header => request.headers.get(header)).find(
    h => !!h
  )
  if (!authHeader) {
    authHeader = request.nextUrl.searchParams.get(authGetParams)
  }
  return authHeader ? authHeader.trim() : undefined
}

/**
 * Validates auth key and returns the workspace it belongs to
 * @param request - The NextRequest object (used if key is not provided)
 * @param key - Optional auth key to validate (if not provided, extracts from request)
 * @returns The workspace the auth key belongs to
 */
export async function validateAuthKey(
  request: NextRequest,
  key?: string | null
): Promise<{ workspaceId: string }> {
  if (serverEnv.DISABLE_AUTHENTICATION) {
    // In development mode without auth, we need a default workspace
    // This is a fallback and should not be used in production
    const workspace = await prisma.workspace.findFirst()
    if (!workspace) {
      throw new HttpError(500, 'No workspace found in database')
    }
    return { workspaceId: workspace.id }
  }

  const authKeyString = key ?? getAuthKey(request)

  if (!authKeyString) {
    throw new HttpError(401, 'Unauthorized - auth key is missing')
  }

  const authKey = await prisma.authKey.findUnique({
    where: {
      key: authKeyString,
      deletedAt: null,
    },
  })

  if (!authKey) {
    throw new HttpError(401, 'Unauthorized: Invalid or missing API key')
  }

  if (!authKey.workspaceId) {
    throw new HttpError(
      401,
      'Unauthorized: API key is not associated with a workspace'
    )
  }

  return { workspaceId: authKey.workspaceId }
}

export function extractHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'x-auth') {
      headers[key.toLowerCase()] = value
    }
  })
  return headers
}

export function applyUpstreamHeaders(
  requestHeaders: Record<string, string>,
  upstreamHeaders: any
): void {
  if (!upstreamHeaders) return

  if (Array.isArray(upstreamHeaders)) {
    // New format: array of {name, value, priority}
    // Apply low priority headers first, then high priority (which can override)
    const sortedHeaders = [...upstreamHeaders].sort((a: any, b: any) => {
      if (a.priority === 'low' && b.priority === 'high') return -1
      if (a.priority === 'high' && b.priority === 'low') return 1
      return 0
    })
    sortedHeaders.forEach((header: any) => {
      if (header.name) {
        requestHeaders[header.name.toLowerCase()] = header.value
      }
    })
  } else if (typeof upstreamHeaders === 'object') {
    // Old format: object
    Object.entries(upstreamHeaders).forEach(([key, value]) => {
      requestHeaders[String(key).toLowerCase()] = String(value)
    })
  }
}

export async function captureResponseBody(
  response: Response,
  onCapture: (body: Buffer, headers: Record<string, string>) => Promise<void>
): Promise<ReadableStream> {
  const capturedChunks: Uint8Array[] = []
  let totalSize = 0

  // Create a transform stream to capture data while passing it through
  const captureStream = new TransformStream({
    transform(chunk, controller) {
      capturedChunks.push(new Uint8Array(chunk))
      totalSize += chunk.byteLength
      controller.enqueue(chunk)
    },
  })

  // Tee the response body - one stream goes to capture, other to client
  const [captureReader, clientStream] = response.body!.tee()

  // Pipe one stream through our capture transform
  captureReader.pipeThrough(captureStream)

  // Set up headers for response
  const responseHeaders: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value
  })

  // Start the capture process in the background
  const capturePromise = (async () => {
    try {
      const reader = captureStream.readable.getReader()
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }

      // Combine all captured chunks
      const capturedBody = new Uint8Array(totalSize)
      let offset = 0
      for (const chunk of capturedChunks) {
        capturedBody.set(chunk, offset)
        offset += chunk.length
      }

      console.log(`Body size: ${totalSize} bytes`)

      // Limit response body logging to prevent huge logs
      const responseText = Buffer.from(capturedBody).toString('utf-8')
      const maskedResponse = maskSensitiveData(responseText)
      if (maskedResponse.length > 2000) {
        console.log(
          `Response Body (truncated):\n`,
          maskedResponse.substring(0, 2000) + '...'
        )
      } else {
        console.log(`Response Body:\n`, maskedResponse)
      }

      // Get content encoding and decompress if needed
      const contentEncoding = response.headers.get('content-encoding')
      const decompressedBody = await decompressResponse(
        capturedBody.buffer,
        contentEncoding
      )

      await onCapture(decompressedBody, responseHeaders)
    } catch (error) {
      console.error('Error capturing response:', error)
    }
  })()

  // Don't await the capture - let it happen in background
  capturePromise.catch(console.error)

  return clientStream
}
