import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkWorkspaceAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const { workspace } = await checkWorkspaceAuth(request)
    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor')
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    if (limit > 100) {
      return NextResponse.json(
        { error: 'Limit cannot exceed 100' },
        { status: 400 }
      )
    }

    const responses = await prisma.response.findMany({
      where: {
        workspaceId: workspace.id,
      },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        url: true,
        method: true,
        status: true,
        requestBody: true,
        responseBody: true,
        requestHeaders: true,
        responseHeaders: true,
        createdAt: true,
      },
    })

    const hasNextPage = responses.length > limit
    const items = hasNextPage ? responses.slice(0, -1) : responses
    const nextCursor = hasNextPage ? responses[responses.length - 2].id : null

    // Process items to add computed fields
    const processedItems = items.map(item => {
      const { requestBody, responseBody, ...itemWithoutBodies } = item
      return {
        ...itemWithoutBodies,
        requestBodySize: requestBody ? requestBody.length : 0,
        responseBodySize: responseBody ? responseBody.length : 0,
        responseContentType:
          item.responseHeaders && typeof item.responseHeaders === 'object'
            ? (item.responseHeaders as any)['content-type'] || '-'
            : '-',
      }
    })

    return NextResponse.json({
      items: processedItems,
      nextCursor,
      hasNextPage,
    })
  } catch (error) {
    console.error('Error fetching requests:', error)
    if (
      error instanceof Error &&
      (error.message.includes('X-Workspace-Id') ||
        error.message.includes('Workspace not found') ||
        error.message.includes('Unauthorized'))
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message.includes('Unauthorized') ? 401 : 400 }
      )
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
