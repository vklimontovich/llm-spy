import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hasAuth } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params },
) {
  try {
    const requestId = (await params).id

    // First check if the request exists
    const requestExists = await prisma.response.findFirst({
      where: { id: requestId },
      select: { id: true, public: true },
    })


    if (!requestExists) {
      return NextResponse.json({ error: 'Request not found', type: 'not_found' }, { status: 404 })
    }

    console.log('Has auth', await hasAuth(), requestExists?.public)

    if (!requestExists?.public && !(await hasAuth())) {
      return NextResponse.json({ error: 'This request is not publicly shared', type: 'not_shared' }, { status: 403 })
    }

    const response = await prisma.response.findFirst({
      where: {
        id: requestId,
      },
      select: {
        id: true,
        url: true,
        method: true,
        status: true,
        requestHeaders: true,
        responseHeaders: true,
        createdAt: true,
        public: true,
      },
    })

    if (!response) {
      return NextResponse.json({ error: 'Request not found or not shared', type: 'not_shared' }, { status: 404 })
    }

    // Calculate body sizes
    const requestBodySize = response.requestHeaders ?
      Buffer.from(JSON.stringify(response.requestHeaders)).length : 0
    const responseBodySize = response.responseHeaders ?
      Buffer.from(JSON.stringify(response.responseHeaders)).length : 0

    // Get response content type
    const responseContentType = response.responseHeaders?.['content-type'] || null

    return NextResponse.json({
      ...response,
      requestBodySize,
      responseBodySize,
      responseContentType,
    })
  } catch (error) {
    console.error('Error fetching public request:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}