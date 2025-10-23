import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { Filters } from '@/types/requests'

export interface LlmCallsSelectParams {
  workspaceId: string
  cursor?: string | null
  limit: number
  previewLength?: number
  filters?: Filters
}

export async function select_llm_calls({
  workspaceId,
  cursor,
  limit,
  previewLength = 50,
  filters = [],
}: LlmCallsSelectParams) {
  // Build WHERE clause for filters
  let whereClause = Prisma.sql`workspace_id = ${workspaceId}`

  if (cursor) {
    whereClause = Prisma.sql`${whereClause} AND "createdAt" < (SELECT "createdAt" FROM responses WHERE id = ${cursor})`
  }

  // Apply filters
  for (const filter of filters) {
    const { field, expr, value, values } = filter

    if (expr === '=') {
      if (field === 'conversationId') {
        if (value) {
          whereClause = Prisma.sql`${whereClause} AND conversation_id = ${value}`
        } else if (values && values.length > 0) {
          whereClause = Prisma.sql`${whereClause} AND conversation_id = ANY(${values})`
        }
      }
      // Add more field support here as needed
    }
  }

  const query = prisma.$queryRaw<any[]>`
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
      conversation_id as "conversationId",
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
    WHERE ${whereClause}
    ORDER BY "createdAt" DESC
    LIMIT ${limit + 1}
  `

  return await query
}
