import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  applyUpstreamHeaders,
  authGetParams,
  captureResponseBody,
  decompressResponse,
  extractHeaders,
  getAuthKey,
  HttpError,
  validateAuthKey,
} from '@/lib/route-helpers'
import { maskSensitiveData } from '@/lib/log-masking'
import { maskSecurityValues } from '@/lib/security'
import { postProcessResponse } from '@/lib/request-post-processing'

export async function handleProxy(request: NextRequest) {
  const method = request.method.toUpperCase()
  try {
    // Step 1: Get auth key (must be present)
    const fullAuthKey = getAuthKey(request)
    if (!fullAuthKey) {
      throw new HttpError(401, 'Unauthorized - auth key is missing')
    }

    // Step 2: Parse key to extract upstream name and actual key
    let upstreamName: string | undefined
    let actualKey: string
    const colonIndex = fullAuthKey.indexOf(':')

    if (colonIndex !== -1) {
      // Key format: {upstreamName}:{key}
      upstreamName = fullAuthKey.substring(0, colonIndex)
      actualKey = fullAuthKey.substring(colonIndex + 1)
    } else {
      // Key doesn't have ':', check for X-Upstream-Id header
      const upstreamId = request.headers.get('x-upstream-id')
      if (!upstreamId) {
        throw new HttpError(
          400,
          'Bad Request - either provide X-Upstream-Id header or use auth key in format {upstreamName}:{key}'
        )
      }
      upstreamName = upstreamId
      actualKey = fullAuthKey
    }

    // Step 3: Validate auth key and get workspace ID
    const { workspaceId } = await validateAuthKey(request, actualKey)

    // Step 4: Find upstream by name or ID
    const upstream = await prisma.upstream.findFirst({
      where: {
        OR: [{ name: upstreamName }, { id: upstreamName }],
        workspaceId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        url: true,
        headers: true,
        inputFormat: true,
        outputFormat: true,
        keepAuthHeaders: true,
        workspaceId: true,
      },
    })

    if (!upstream) {
      console.log(
        `Upstream not found: ${upstreamName} for method ${method} ${request.url}`
      )
      return NextResponse.json({ error: 'Upstream not found' }, { status: 404 })
    }

    let requestBody: ArrayBuffer | null = null
    let decompressedRequestBody: Buffer | null = null

    if (method !== 'GET' && method !== 'DELETE') {
      requestBody = await request.arrayBuffer()
      if (requestBody) {
        const requestContentEncoding = request.headers.get('content-encoding')
        console.log(
          `[proxy] Request content-encoding: ${requestContentEncoding || 'none'}, body size: ${requestBody.byteLength} bytes`
        )
        decompressedRequestBody = await decompressResponse(
          requestBody,
          requestContentEncoding
        )
        console.log(
          `[proxy] Decompressed request body size: ${decompressedRequestBody?.length || 0} bytes`
        )
      }
    }

    const requestHeaders = extractHeaders(request)
    applyUpstreamHeaders(requestHeaders, upstream.headers)

    if (!upstream.url) {
      const acceptHeader = request.headers.get('accept') || ''
      const contentType = request.headers.get('content-type') || ''

      let responseBody: string | Buffer
      let responseHeaders: Record<string, string>

      if (
        acceptHeader.includes('application/json') ||
        contentType.includes('application/json')
      ) {
        responseBody = JSON.stringify({
          status: 'ok',
          message: 'Upstream configured but no URL set',
        })
        responseHeaders = { 'content-type': 'application/json' }
      } else if (
        acceptHeader.includes('text/html') ||
        contentType.includes('text/html')
      ) {
        responseBody =
          '<html><body><h1>OK</h1><p>Upstream configured but no URL set</p></body></html>'
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
          requestHeaders: upstream.keepAuthHeaders
            ? requestHeaders
            : maskSecurityValues(requestHeaders),
          responseHeaders: upstream.keepAuthHeaders
            ? responseHeaders
            : maskSecurityValues(responseHeaders),
          workspaceId,
        },
      })

      return new NextResponse(responseBody, {
        status: 200,
        headers: responseHeaders,
      })
    }

    const url = new URL(request.url)

    // Filter out unwanted query parameters
    const paramsToRemove = [authGetParams]
    const filteredSearchParams = new URLSearchParams(url.searchParams)
    paramsToRemove.forEach(param => filteredSearchParams.delete(param))
    const filteredSearch = filteredSearchParams.toString()
    const searchString = filteredSearch ? `?${filteredSearch}` : ''

    // Use the full pathname from the request, avoiding double slashes
    const baseUrl = upstream.url.endsWith('/')
      ? upstream.url.slice(0, -1)
      : upstream.url
    const pathname = url.pathname.startsWith('/')
      ? url.pathname
      : `/${url.pathname}`
    const targetUrl = `${baseUrl}${pathname}${searchString}`
    console.log(
      `[proxy] ${method.toUpperCase()} ${request.url} -> ${targetUrl}`
    )
    console.log(
      `[proxy] Upstream: ${upstream.name} (${upstream.id}), workspace: ${workspaceId}`
    )

    // Track start time for duration
    const startTime = Date.now()

    // Check if format conversion is needed
    const needsConversion =
      upstream.outputFormat && upstream.inputFormat !== upstream.outputFormat
    if (
      needsConversion &&
      (!decompressedRequestBody || decompressedRequestBody.length === 0)
    ) {
      return NextResponse.json(
        { error: 'Request body required for format conversion' },
        { status: 400 }
      )
    }

    let response: Response

    if (needsConversion && decompressedRequestBody) {
      throw new Error('Not implemented')
    } else {
      console.log(`[proxy] Sending request to: ${targetUrl}`)
      console.log(
        `[proxy] Request headers:`,
        Object.keys(requestHeaders).join(', ')
      )
      // Regular proxy without conversion
      response = await fetch(targetUrl, {
        method,
        headers: requestHeaders,
        body: requestBody,
      })
    }

    console.log(
      `[proxy] Response status: ${response.status}, content-type: ${response.headers.get('content-type')}, content-encoding: ${response.headers.get('content-encoding')}`
    )

    // Log request body for audit purposes
    if (decompressedRequestBody) {
      const requestText = decompressedRequestBody.toString('utf-8')
      const maskedRequest = maskSensitiveData(requestText)
      if (maskedRequest.length > 2000) {
        console.log(
          `[proxy] Request Body (truncated):\n`,
          maskedRequest.substring(0, 2000) + '...'
        )
      } else {
        console.log(`[proxy] Request Body:\n`, maskedRequest)
      }
    }

    // Capture response and extract metadata
    const clientStream = await captureResponseBody(
      response,
      async (decompressedResponseBody, responseHeaders) => {
        const durationMs = Date.now() - startTime
        console.log(`[proxy] Request duration: ${durationMs}ms`)

        // Post-process the response to extract model information
        const initialProvider = upstream.headers?.['x-provider'] || null
        console.log(
          `[proxy] Post-processing response, provider: ${initialProvider}`
        )

        const postProcessed = await postProcessResponse({
          requestBody: decompressedRequestBody,
          responseBody: decompressedResponseBody,
          requestHeaders,
          responseHeaders,
          provider: initialProvider,
          url: targetUrl,
          method,
        })

        console.log(
          `[proxy] Post-processed: conversationId=${postProcessed.conversationId}, sessionId=${postProcessed.sessionId}, model=${postProcessed.requestModel || 'none'}`
        )

        // Store in database with new fields
        const saved = await prisma.response.create({
          data: {
            url: targetUrl,
            method,
            status: response.status,
            requestUrl: targetUrl,
            requestMethod: method,
            requestBody: decompressedRequestBody,
            responseBody: decompressedResponseBody,
            requestHeaders: upstream.keepAuthHeaders
              ? requestHeaders
              : maskSecurityValues(requestHeaders),
            responseHeaders: upstream.keepAuthHeaders
              ? responseHeaders
              : maskSecurityValues(responseHeaders),
            conversationId: postProcessed.conversationId,
            sessionId: postProcessed.sessionId,
            workspaceId,
            upstreamId: upstream.id,
            provider: postProcessed.provider,
            requestModel: postProcessed.requestModel,
            responseModel: postProcessed.responseModel,
            usage: postProcessed.usage,
            pricing: postProcessed.pricing,
            preview: postProcessed.preview,
            durationMs,
          },
        })
        console.log(
          '[save] response saved:',
          saved.id,
          '| pricing:',
          postProcessed.pricing
            ? JSON.stringify(postProcessed.pricing)
            : 'none',
          '| usage:',
          postProcessed.usage ? 'present' : 'none',
          '| duration:',
          durationMs + 'ms'
        )
      }
    )

    // Set up response headers
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    return new NextResponse(clientStream, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('[proxy] ERROR:', error)
    if (error instanceof Error) {
      console.error('[proxy] Error stack:', error.stack)
    }
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export { handleProxy as GET }
export { handleProxy as POST }
export { handleProxy as PUT }
export { handleProxy as DELETE }
export { handleProxy as PATCH }
