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
import { extractConversationId } from '@/lib/session-utils'
import {
  ConversationModel,
  detectProviderFromRequest,
  getParserForProvider,
} from '@/lib/format'
import { isSSEResponse, parseSSEEvents } from '@/lib/sse-utils'
import { getPricing } from '@/lib/pricing'
import { maskSensitiveData } from '@/lib/log-masking'
import { getPreview } from '@/lib/preview'
import { maskSecurityValues } from '@/lib/security'

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
        decompressedRequestBody = await decompressResponse(
          requestBody,
          requestContentEncoding
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

      const conversationId = extractConversationId(requestHeaders)
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
          conversationId,
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
      `Proxying ${method.toUpperCase()} ${request.url} -> ${targetUrl}`
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
      console.log(`Proxying request to: ${targetUrl}`)
      // Regular proxy without conversion
      response = await fetch(targetUrl, {
        method,
        headers: requestHeaders,
        body: requestBody,
      })
    }

    console.log(`Response status: ${response.status}`)

    // Log request body for audit purposes
    if (decompressedRequestBody) {
      const requestText = decompressedRequestBody.toString('utf-8')
      const maskedRequest = maskSensitiveData(requestText)
      if (maskedRequest.length > 2000) {
        console.log(
          `Request Body (truncated):\n`,
          maskedRequest.substring(0, 2000) + '...'
        )
      } else {
        console.log(`Request Body:\n`, maskedRequest)
      }
    }

    // Capture response and extract metadata
    const clientStream = await captureResponseBody(
      response,
      async (decompressedResponseBody, responseHeaders) => {
        const durationMs = Date.now() - startTime

        // Try to parse the request/response to extract model information
        let conversationModel: ConversationModel | undefined
        let provider = upstream.headers?.['x-provider'] || null
        let requestModel: string | undefined
        let responseModel: string | undefined
        let usageRaw: any | undefined
        let pricingData: any | undefined
        let preview: { input: string; output: string } | undefined

        try {
          // Try to detect provider from request if not set
          if (!provider && decompressedRequestBody) {
            const requestJson = JSON.parse(
              decompressedRequestBody.toString('utf-8')
            )
            provider = detectProviderFromRequest(requestHeaders, requestJson)
          }

          // Get parser for the provider
          const parser = getParserForProvider(provider)
          if (parser && decompressedRequestBody) {
            try {
              const requestJson = JSON.parse(
                decompressedRequestBody.toString('utf-8')
              )
              // Parse response as JSON or reconstruct from SSE when streaming
              let responseJson: any
              const responseText = decompressedResponseBody.toString('utf-8')
              if (isSSEResponse(responseHeaders)) {
                responseJson = parser.getJsonFromSSE(
                  parseSSEEvents(responseText)
                )
              } else {
                try {
                  responseJson = JSON.parse(responseText)
                } catch {
                  // Fallback: attempt SSE reconstruction if JSON parsing fails
                  responseJson = parser.getJsonFromSSE(
                    parseSSEEvents(responseText)
                  )
                }
              }

              conversationModel = parser.createConversation(
                requestJson,
                responseJson
              )
              if (conversationModel) {
                requestModel = conversationModel.models.request
                responseModel = conversationModel.models.response
                // Persist the raw usage block from provider if available
                usageRaw =
                  (responseJson as any)?.usage ?? conversationModel.usage

                // Calculate pricing lookup; save raw cost node as-is
                if (responseModel) {
                  pricingData = await getPricing(responseModel)
                  if (pricingData) {
                    console.log(`[pricing] Found cost for ${responseModel}`)
                  } else {
                    console.warn(
                      `[pricing] No cost found for model ${responseModel}`
                    )
                  }
                }

                // Generate preview from conversation
                const messages = conversationModel.modelMessages
                const lastUserMessage = messages.findLast(
                  m => m.role === 'user'
                )
                const lastAssistantMessage = messages.findLast(
                  m => m.role === 'assistant'
                )

                preview = {
                  input: getPreview(lastUserMessage, 100),
                  output: getPreview(lastAssistantMessage, 100),
                }
              }
            } catch (parseError) {
              console.warn('Failed to parse conversation model:', parseError)
            }
          }
        } catch (error) {
          console.warn('Failed to extract model information:', error)
        }

        // Store in database with new fields
        const conversationId = extractConversationId(requestHeaders)
        const saved = await prisma.response.create({
          data: {
            url: targetUrl,
            method,
            status: response.status,
            requestBody: decompressedRequestBody,
            responseBody: decompressedResponseBody,
            requestHeaders: upstream.keepAuthHeaders
              ? requestHeaders
              : maskSecurityValues(requestHeaders),
            responseHeaders: upstream.keepAuthHeaders
              ? responseHeaders
              : maskSecurityValues(responseHeaders),
            conversationId,
            workspaceId,
            upstreamId: upstream.id,
            provider,
            requestModel,
            responseModel,
            usage: usageRaw,
            pricing: pricingData,
            preview,
            durationMs,
          },
        })
        try {
          console.log(
            '[save] response saved:',
            saved.id,
            '| pricing:',
            pricingData ? JSON.stringify(pricingData) : 'none',
            '| usage:',
            usageRaw ? 'present' : 'none'
          )
        } catch {}
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
    console.error('Proxy error:', error)
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
