import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod/v4'
import { gunzip, inflate, brotliDecompress } from 'zlib'
import { promisify } from 'util'
import { prisma } from '@/lib/prisma'

const gunzipAsync = promisify(gunzip)
const inflateAsync = promisify(inflate)
const brotliDecompressAsync = promisify(brotliDecompress)

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

const AUTH_HEADERS = ['x-monitor-auth', 'x-llmspy-auth']
export const authGetParams = '__llmspy_auth_key'

export async function validateAuthKey(
  request: NextRequest,
  workspaceId: string | null
): Promise<void> {
  if (process.env.DISABLE_AUTHENTICATION === 'true') {
    return
  }
  let authHeader = AUTH_HEADERS.map((header) => request.headers.get(header)).find(h => !!h)
  if (!authHeader) {
    authHeader = request.nextUrl.searchParams.get(authGetParams)
  }

  if (!authHeader) {
    throw new HttpError(401, 'Unauthorized - auth key is missing')
  }

  const authKey = await prisma.authKey.findUnique({
    where: {
      key: authHeader.trim(),
      deletedAt: null,
    },
  })

  if (!authKey) {
    throw new HttpError(401, 'Unauthorized: Invalid or missing API key')
  }

  // Check if auth key belongs to the workspace (if workspaceId is provided)
  if (
    workspaceId &&
    authKey.workspaceId &&
    authKey.workspaceId !== workspaceId
  ) {
    throw new HttpError(
      401,
      'Unauthorized: API key does not belong to this workspace'
    )
  }
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
      if (responseText.length > 2000) {
        console.log(
          `Response Body (truncated):\n`,
          responseText.substring(0, 2000) + '...'
        )
      } else {
        console.log(`Response Body:\n`, responseText)
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
