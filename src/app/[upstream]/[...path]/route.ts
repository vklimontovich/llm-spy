import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { gunzip, inflate, brotliDecompress } from 'zlib'
import { promisify } from 'util'
import { HttpError } from '@/lib/route-helpers'

const gunzipAsync = promisify(gunzip)
const inflateAsync = promisify(inflate)
const brotliDecompressAsync = promisify(brotliDecompress)


async function decompressResponse(responseBody: ArrayBuffer, contentEncoding: string | null): Promise<Buffer> {
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

const AUTH_HEADER = 'x-monitor-auth'

async function validateAuthKey(request: NextRequest): Promise<void> {
  if (process.env.DISABLE_AUTHENTICATION === 'true') {
    return
  }
  const authHeader = request.headers.get(AUTH_HEADER)

  if (!authHeader) {
    throw new HttpError(401, 'Unauthorized - x-monitor-auth header missing')
  }

  const authKey = await prisma.authKey.findUnique({
    where: {
      key: authHeader.trim(),
      deletedAt: null,
    },
  })

  if (!authKey) {
    throw new HttpError(401, 'Unauthorized: Invalid or missing API key. Use X-Auth header')
  }
}


async function handleProxy(
  request: NextRequest,
  { params }: { params: Promise<Record<string, string>> },
) {
  const method = request.method.toUpperCase()
  try {
    await validateAuthKey(request)

    const _params = await params
    const { upstream: upstreamName } = _params


    const upstream = await prisma.upstream.findUnique({
      where: { name: upstreamName },
    })

    if (!upstream) {
      console.log(`Upstream not found: ${upstreamName} for method ${method} ${request.url}`)
      return NextResponse.json(
        { error: 'Upstream not found' },
        { status: 404 },
      )
    }

    let requestBody: ArrayBuffer | null = null
    let decompressedRequestBody: Buffer | null = null

    if (method !== 'GET' && method !== 'DELETE') {
      requestBody = await request.arrayBuffer()
      if (requestBody) {
        const requestContentEncoding = request.headers.get('content-encoding')
        decompressedRequestBody = await decompressResponse(requestBody, requestContentEncoding)
      }
    }

    const requestHeaders: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'x-auth') {
        requestHeaders[key.toLowerCase()] = value
      }
    })

    if (upstream.headers && typeof upstream.headers === 'object') {
      Object.entries(upstream.headers).forEach(([key, value]) => requestHeaders[String(key).toLowerCase()] = String(value))
    }

    if (!upstream.url) {
      const acceptHeader = request.headers.get('accept') || ''
      const contentType = request.headers.get('content-type') || ''

      let responseBody: string | Buffer
      let responseHeaders: Record<string, string>

      if (acceptHeader.includes('application/json') || contentType.includes('application/json')) {
        responseBody = JSON.stringify({ status: 'ok', message: 'Upstream configured but no URL set' })
        responseHeaders = { 'content-type': 'application/json' }
      } else if (acceptHeader.includes('text/html') || contentType.includes('text/html')) {
        responseBody = '<html><body><h1>OK</h1><p>Upstream configured but no URL set</p></body></html>'
        responseHeaders = { 'content-type': 'text/html' }
      } else {
        responseBody = 'OK: Upstream configured but no URL set'
        responseHeaders = { 'content-type': 'text/plain' }
      }

      await prisma.response.create({
        data: {
          url: request.url,
          method,
          status: 200,
          requestBody: decompressedRequestBody,
          responseBody: Buffer.from(responseBody),
          requestHeaders,
          responseHeaders,
        },
      })

      return new NextResponse(responseBody, {
        status: 200,
        headers: responseHeaders,
      })
    }

    const url = new URL(request.url)
    const targetUrl = `${upstream.url}${url.pathname.replace(`/${upstreamName}`, '')}${url.search}`


    const response = await fetch(targetUrl, {
      method,
      headers: requestHeaders,
      body: requestBody,
    })

    console.log(`Proxying ${method.toUpperCase()} ${request.url} -> ${targetUrl}. Response status: ${response.status}`)
    console.log(`Request headers:\n`, requestHeaders)
    console.log(`Response headers:\n`, response.headers)

    // Log request body for audit purposes
    if (decompressedRequestBody) {
      const requestText = decompressedRequestBody.toString('utf-8')
      if (requestText.length > 2000) {
        console.log(`Request Body (truncated):\n`, requestText.substring(0, 2000) + '...')
      } else {
        console.log(`Request Body:\n`, requestText)
      }
    }

    // Always use tee approach to capture response while streaming to client
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
          console.log(`Response Body (truncated):\n`, responseText.substring(0, 2000) + '...')
        } else {
          console.log(`Response Body:\n`, responseText)
        }

        // Get content encoding and decompress if needed
        const contentEncoding = response.headers.get('content-encoding')
        const decompressedBody = await decompressResponse(capturedBody.buffer, contentEncoding)

        // Store in database
        await prisma.response.create({
          data: {
            url: targetUrl,
            method,
            status: response.status,
            requestBody: decompressedRequestBody,
            responseBody: decompressedBody,
            requestHeaders,
            responseHeaders,
          },
        })
      } catch (error) {
        console.error('Error capturing response:', error)
      }
    })()

    // Don't await the capture - let it happen in background
    capturePromise.catch(console.error)

    return new NextResponse(clientStream, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })

  } catch (error) {
    console.error('Proxy error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

export {
  handleProxy as GET,
  handleProxy as POST,
  handleProxy as PUT,
  handleProxy as DELETE,
  handleProxy as PATCH,
}