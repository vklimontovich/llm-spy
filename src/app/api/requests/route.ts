import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkWorkspaceAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const { workspace } = await checkWorkspaceAuth(request)
    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor')
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const previewLength = 50 // Configurable preview length

    if (limit > 100) {
      return NextResponse.json(
        { error: 'Limit cannot exceed 100' },
        { status: 400 }
      )
    }

    // Use raw query to generate preview on database side
    const query = cursor
      ? prisma.$queryRaw<any[]>`
          SELECT 
            id,
            url,
            method,
            status,
            "requestHeaders",
            "responseHeaders",
            "createdAt",
            provider,
            request_model as "requestModel",
            response_model as "responseModel",
            usage,
            pricing,
            duration_ms as "durationMs",
            CASE 
              WHEN "requestBody" IS NOT NULL AND "responseBody" IS NOT NULL THEN
                CONCAT(
                  LEFT(REGEXP_REPLACE(
                    COALESCE(
                      CASE 
                        WHEN LEFT(CONVERT_FROM("requestBody", 'UTF8'), 1) IN ('{', '[') THEN 
                          CONVERT_FROM("requestBody", 'UTF8')::jsonb::text
                        ELSE 
                          CONVERT_FROM("requestBody", 'UTF8')
                      END,
                      ENCODE("requestBody", 'escape')
                    ), 
                    E'[\\n\\r\\t]+', ' ', 'g'
                  ), ${previewLength}::int),
                  E'\\n',
                  '→ ',
                  LEFT(REGEXP_REPLACE(
                    COALESCE(
                      CASE 
                        WHEN LEFT(CONVERT_FROM("responseBody", 'UTF8'), 1) IN ('{', '[') THEN 
                          CONVERT_FROM("responseBody", 'UTF8')::jsonb::text
                        ELSE 
                          CONVERT_FROM("responseBody", 'UTF8')
                    END,
                      ENCODE("responseBody", 'escape')
                    ), 
                    E'[\\n\\r\\t]+', ' ', 'g'
                  ), ${previewLength}::int)
                )
              WHEN "requestBody" IS NOT NULL THEN
                LEFT(REGEXP_REPLACE(
                  COALESCE(
                    CASE 
                      WHEN LEFT(CONVERT_FROM("requestBody", 'UTF8'), 1) IN ('{', '[') THEN 
                        CONVERT_FROM("requestBody", 'UTF8')::jsonb::text
                      ELSE 
                        CONVERT_FROM("requestBody", 'UTF8')
                    END,
                    ENCODE("requestBody", 'escape')
                  ), 
                  E'[\\n\\r\\t]+', ' ', 'g'
                ), ${previewLength * 2}::int)
              WHEN "responseBody" IS NOT NULL THEN
                CONCAT('→ ', LEFT(REGEXP_REPLACE(
                  COALESCE(
                    CASE 
                      WHEN LEFT(CONVERT_FROM("responseBody", 'UTF8'), 1) IN ('{', '[') THEN 
                        CONVERT_FROM("responseBody", 'UTF8')::jsonb::text
                      ELSE 
                        CONVERT_FROM("responseBody", 'UTF8')
                    END,
                    ENCODE("responseBody", 'escape')
                  ), 
                  E'[\\n\\r\\t]+', ' ', 'g'
                ), ${previewLength * 2}::int))
              ELSE '-'
            END as preview,
            COALESCE(OCTET_LENGTH("requestBody"), 0) as "requestBodySize",
            COALESCE(OCTET_LENGTH("responseBody"), 0) as "responseBodySize"
          FROM responses
          WHERE workspace_id = ${workspace.id}
            AND "createdAt" < (SELECT "createdAt" FROM responses WHERE id = ${cursor})
          ORDER BY "createdAt" DESC
          LIMIT ${limit + 1}
        `
      : prisma.$queryRaw<any[]>`
          SELECT 
            id,
            url,
            method,
            status,
            "requestHeaders",
            "responseHeaders",
            "createdAt",
            provider,
            request_model as "requestModel",
            response_model as "responseModel",
            usage,
            pricing,
            duration_ms as "durationMs",
            CASE 
              WHEN "requestBody" IS NOT NULL AND "responseBody" IS NOT NULL THEN
                CONCAT(
                  LEFT(REGEXP_REPLACE(
                    COALESCE(
                      CASE 
                        WHEN LEFT(CONVERT_FROM("requestBody", 'UTF8'), 1) IN ('{', '[') THEN 
                          CONVERT_FROM("requestBody", 'UTF8')::jsonb::text
                        ELSE 
                          CONVERT_FROM("requestBody", 'UTF8')
                      END,
                      ENCODE("requestBody", 'escape')
                    ), 
                    E'[\\n\\r\\t]+', ' ', 'g'
                  ), ${previewLength}::int),
                  E'\\n',
                  '→ ',
                  LEFT(REGEXP_REPLACE(
                    COALESCE(
                      CASE 
                        WHEN LEFT(CONVERT_FROM("responseBody", 'UTF8'), 1) IN ('{', '[') THEN 
                          CONVERT_FROM("responseBody", 'UTF8')::jsonb::text
                        ELSE 
                          CONVERT_FROM("responseBody", 'UTF8')
                    END,
                      ENCODE("responseBody", 'escape')
                    ), 
                    E'[\\n\\r\\t]+', ' ', 'g'
                  ), ${previewLength}::int)
                )
              WHEN "requestBody" IS NOT NULL THEN
                LEFT(REGEXP_REPLACE(
                  COALESCE(
                    CASE 
                      WHEN LEFT(CONVERT_FROM("requestBody", 'UTF8'), 1) IN ('{', '[') THEN 
                        CONVERT_FROM("requestBody", 'UTF8')::jsonb::text
                      ELSE 
                        CONVERT_FROM("requestBody", 'UTF8')
                    END,
                    ENCODE("requestBody", 'escape')
                  ), 
                  E'[\\n\\r\\t]+', ' ', 'g'
                ), ${previewLength * 2}::int)
              WHEN "responseBody" IS NOT NULL THEN
                CONCAT('→ ', LEFT(REGEXP_REPLACE(
                  COALESCE(
                    CASE 
                      WHEN LEFT(CONVERT_FROM("responseBody", 'UTF8'), 1) IN ('{', '[') THEN 
                        CONVERT_FROM("responseBody", 'UTF8')::jsonb::text
                      ELSE 
                        CONVERT_FROM("responseBody", 'UTF8')
                    END,
                    ENCODE("responseBody", 'escape')
                  ), 
                  E'[\\n\\r\\t]+', ' ', 'g'
                ), ${previewLength * 2}::int))
              ELSE '-'
            END as preview,
            COALESCE(OCTET_LENGTH("requestBody"), 0) as "requestBodySize",
            COALESCE(OCTET_LENGTH("responseBody"), 0) as "responseBodySize"
          FROM responses
          WHERE workspace_id = ${workspace.id}
          ORDER BY "createdAt" DESC
          LIMIT ${limit + 1}
        `

    const responses = await query

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
