import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { withError } from '@/lib/route-helpers'
import { requireDefined } from '@/lib/preconditions'
import { getProvider } from '@/lib/format'
import { parseSSEEvents } from '@/lib/sse-utils'

const getFileExtension = (contentType: string): string => {
  const mimeToExt: Record<string, string> = {
    'application/json': 'json',
    'application/xml': 'xml',
    'text/xml': 'xml',
    'text/html': 'html',
    'text/css': 'css',
    'text/javascript': 'js',
    'application/javascript': 'js',
    'text/plain': 'txt',
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'application/zip': 'zip',
    'application/octet-stream': 'bin',
    'video/mp4': 'mp4',
    'audio/mpeg': 'mp3',
  }

  if (mimeToExt[contentType]) {
    return mimeToExt[contentType]
  }

  if (contentType.includes('json')) return 'json'
  if (contentType.includes('xml')) return 'xml'
  if (contentType.includes('html')) return 'html'
  if (contentType.includes('css')) return 'css'
  if (contentType.includes('javascript')) return 'js'
  if (contentType.startsWith('text/')) return 'txt'
  if (contentType.startsWith('image/')) return 'img'
  if (contentType.startsWith('video/')) return 'video'
  if (contentType.startsWith('audio/')) return 'audio'

  return 'bin'
}

export const GET = withError(async (request: NextRequest) => {

  const { searchParams } = new URL(request.url)

  const id = searchParams.get('id') || ''

  const response = requireDefined(await prisma.response.findUnique({ where: { id } }), `Response ${id} not found`)

  if (!response.public) {
    await requireAuth()
  }

  // If no type specified, return both request and response
  const requestBody = response.requestBody
  const responseBody = response.responseBody
  const responseHeaders = response.responseHeaders as Record<string, string>

  // Process request
  let rawRequest: any = null
  if (requestBody) {
    const requestText = requestBody instanceof Uint8Array
      ? new TextDecoder().decode(requestBody)
      : typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody)

    try {
      rawRequest = JSON.parse(requestText)
    } catch {
      rawRequest = requestText
    }
  }

  // Process response - keep raw for client-side reconstruction
  let rawResponse: any = null

  const provider = rawRequest ? getProvider(rawRequest) : undefined

  let rawResponseJson;
  if (responseBody) {
    const responseText = responseBody instanceof Uint8Array
      ? new TextDecoder().decode(responseBody)
      : typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody)

    const responseContentType = responseHeaders?.['content-type'] || ''
    if (responseContentType.includes('text/event-stream')) {
      // Keep raw SSE text for client-side reconstruction
      rawResponseJson = parseSSEEvents(responseText)
      rawResponse = responseText
      if (provider) {
        // Let provider parse SSE events if possible
        rawResponseJson = provider.parseSSE(rawResponseJson)
      }
    } else {
      // Not SSE, parse as JSON or leave as text
      try {
        rawResponseJson = rawResponse = JSON.parse(responseText)
      } catch {
        rawResponse = responseText
      }
    }
  }

  // Try to parse conversation from request
  let conversation = undefined

  if (provider) {
    conversation = provider.createConversation(rawRequest, rawResponseJson)
  }

  return {
    provider: provider?.getParserName(),
    conversation,
    rawResponse,
    rawRequest,
    conversation,
  }
})