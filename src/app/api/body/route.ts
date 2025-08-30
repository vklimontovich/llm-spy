import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkWorkspaceAuth } from '@/lib/auth'
import { withError } from '@/lib/route-helpers'
import { requireDefined } from '@/lib/preconditions'
import { parseSSEEvents } from '@/lib/sse-utils'
import { getParserForProvider } from '@/lib/format'

export const GET = withError(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)

  const id = searchParams.get('id') || ''

  const response = requireDefined(
    await prisma.response.findUnique({ where: { id } }),
    `Response ${id} not found`
  )

  if (!response.public) {
    const { workspace } = await checkWorkspaceAuth(request)

    if (response.workspaceId !== workspace.id) {
      throw new Error('Access denied to this workspace resource')
    }
  }

  // If no type specified, return both request and response
  const requestBody = response.requestBody
  const responseBody = response.responseBody
  const requestHeaders = response.requestHeaders as Record<string, string>
  const responseHeaders = response.responseHeaders as Record<string, string>

  // Process request
  let rawRequestBody: any = null
  if (requestBody) {
    const requestText =
      requestBody instanceof Uint8Array
        ? new TextDecoder().decode(requestBody)
        : typeof requestBody === 'string'
          ? requestBody
          : JSON.stringify(requestBody)

    try {
      rawRequestBody = JSON.parse(requestText)
    } catch {
      rawRequestBody = requestText
    }
  }

  const providerName = response.provider || 'anthropic'

  // Process response - keep raw for client-side reconstruction
  let rawResponseBody: any = null

  const provider = requireDefined(
    getParserForProvider(providerName),
    `No parser found for provider ${providerName}`
  )

  let rawResponseJson
  if (responseBody) {
    const responseText =
      responseBody instanceof Uint8Array
        ? new TextDecoder().decode(responseBody)
        : typeof responseBody === 'string'
          ? responseBody
          : JSON.stringify(responseBody)

    const responseContentType = responseHeaders?.['content-type'] || ''
    if (responseContentType.includes('text/event-stream')) {
      // Keep raw SSE text for client-side reconstruction
      rawResponseJson = parseSSEEvents(responseText)
      rawResponseBody = responseText
      if (provider) {
        // Let provider parse SSE events if possible
        rawResponseJson = provider.parseSSE(rawResponseJson)
      }
    } else {
      // Not SSE, parse as JSON or leave as text
      try {
        rawResponseJson = rawResponseBody = JSON.parse(responseText)
      } catch {
        rawResponseBody = responseText
      }
    }
  }

  // Create structured request and response objects
  const rawRequest = {
    headers: requestHeaders,
    body: rawRequestBody,
    method: response.method,
    url: response.url,
    bodySize: response.requestBody?.length || 0,
    createdAt: response.createdAt,
  }

  const rawResponse = {
    headers: responseHeaders,
    body: rawResponseBody,
    status: response.status,
    bodySize: response.responseBody?.length || 0,
  }

  return {
    provider: provider?.getParserName(),
    rawResponse,
    rawRequest,
    conversation: provider?.createConversation(rawRequestBody, rawResponseJson),
    requestId: response.id,
    public: response.public,
  }
})
