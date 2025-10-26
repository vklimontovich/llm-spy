import { NextRequest, NextResponse } from 'next/server'
import { checkWorkspaceAuth } from '@/lib/auth'
import { selectLlmCalls } from '@/lib/db_queries'
import { FiltersSchema } from '@/types/requests'

export async function GET(request: NextRequest) {
  try {
    const { workspace } = await checkWorkspaceAuth(request)
    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor')
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const filterParam = searchParams.get('filter')

    if (limit > 100) {
      return NextResponse.json(
        { error: 'Limit cannot exceed 100' },
        { status: 400 }
      )
    }

    // Parse and validate filters
    let filters: any[] = []
    if (filterParam) {
      try {
        const parsedFilters = JSON.parse(filterParam)
        const validationResult = FiltersSchema.safeParse(parsedFilters)
        if (!validationResult.success) {
          return NextResponse.json(
            { error: 'Invalid filter format', details: validationResult.error },
            { status: 400 }
          )
        }
        filters = validationResult.data
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON in filter parameter' },
          { status: 400 }
        )
      }
    }

    // Use utility function to fetch LLM calls
    const responses = await selectLlmCalls({
      workspaceId: workspace.id,
      cursor,
      limit,
      filters,
    })

    const hasNextPage = responses.length > limit
    const items = hasNextPage ? responses.slice(0, -1) : responses
    const nextCursor = hasNextPage ? responses[responses.length - 2].id : null

    // Process items to add content-type
    const processedItems = items.map(item => ({
      ...item,
      responseContentType:
        item.responseHeaders && typeof item.responseHeaders === 'object'
          ? (item.responseHeaders as any)['content-type'] || '-'
          : '-',
    }))

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
