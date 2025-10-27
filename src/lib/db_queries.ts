import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { Filters, LlmCall } from '@/schemas/requests'
import { getParserForProvider } from '@/lib/format'
import { computePriceUsd } from '@/lib/pricing'

export interface LlmCallsSelectParams {
  workspaceId: string
  cursor?: string | null
  limit: number
  filters?: Filters
}

export async function selectLlmCalls({
  workspaceId,
  cursor,
  limit,
  filters = { fieldFilters: [] },
}: LlmCallsSelectParams): Promise<LlmCall[]> {
  // Build WHERE clause for filters
  let whereClause = Prisma.sql`workspace_id = ${workspaceId}`

  if (cursor) {
    whereClause = Prisma.sql`${whereClause} AND "createdAt" < (SELECT "createdAt" FROM responses WHERE id = ${cursor})`
  }

  // Apply field filters
  for (const filter of filters.fieldFilters || []) {
    const { field, expr, value, values } = filter

    if (expr === '=') {
      if (field === 'conversationId') {
        if (value) {
          whereClause = Prisma.sql`${whereClause} AND conversation_id = ${value}`
        } else if (values && values.length > 0) {
          whereClause = Prisma.sql`${whereClause} AND conversation_id = ANY(${values})`
        }
      } else if (field === 'sessionId') {
        if (value) {
          whereClause = Prisma.sql`${whereClause} AND session_id = ${value}`
        } else if (values && values.length > 0) {
          whereClause = Prisma.sql`${whereClause} AND session_id = ANY(${values})`
        }
      }
      // Add more field support here as needed
    }
  }

  // Apply full text search filter
  if (filters.fullText && filters.fullText.trim().length > 0) {
    const searchTerm = `%${filters.fullText}%`
    whereClause = Prisma.sql`${whereClause} AND (
      encode("requestBody", 'escape') ILIKE ${searchTerm} OR
      encode("requestBody", 'escape') ILIKE ${searchTerm}
    )`
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
      session_id as "sessionId",
      preview,
      COALESCE(OCTET_LENGTH("requestBody"), 0) as "requestBodySize",
      COALESCE(OCTET_LENGTH("responseBody"), 0) as "responseBodySize"
    FROM responses
    WHERE ${whereClause}
    ORDER BY "createdAt" DESC
    LIMIT ${limit + 1}
  `

  const results = await query

  // Compute price for each result using provider-specific usage parsing
  return results.map(result => {
    let price: number | null = null

    if (
      result.provider &&
      result.usage &&
      result.pricing &&
      result.responseModel
    ) {
      const parser = getParserForProvider(result.provider)
      if (parser) {
        const standardizedUsage = parser.getUsage(result.usage)
        if (standardizedUsage) {
          price = computePriceUsd(
            result.responseModel,
            result.pricing,
            standardizedUsage
          )
        }
      }
    }

    return {
      ...result,
      price,
    }
  })
}
