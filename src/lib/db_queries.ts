import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { Filters, LlmCall } from '@/schemas/requests'
import { getParserForProvider } from '@/lib/format'
import type { UsagePaths } from '@/lib/format/model'

export interface LlmCallsSelectParams {
  workspaceId: string
  cursor?: string | null
  limit: number
  filters?: Filters
  timeRange?: [string, string]
  timeRangePreset?:
    | 'last15m'
    | 'last1h'
    | 'last4h'
    | 'last1d'
    | 'last2d'
    | 'last3d'
    | 'last1w'
    | 'last15d'
    | 'last1m'
}

/**
 * Converts a time range preset to an actual date range.
 *
 * @param preset - The time range preset (e.g., 'last1h', 'last1d')
 * @returns Tuple of [startTime, endTime] in ISO format
 */
function convertTimeRangePreset(
  preset:
    | 'last15m'
    | 'last1h'
    | 'last4h'
    | 'last1d'
    | 'last2d'
    | 'last3d'
    | 'last1w'
    | 'last15d'
    | 'last1m'
): [string, string] {
  const now = new Date()
  const start = new Date(now)

  switch (preset) {
    case 'last15m':
      start.setMinutes(start.getMinutes() - 15)
      break
    case 'last1h':
      start.setHours(start.getHours() - 1)
      break
    case 'last4h':
      start.setHours(start.getHours() - 4)
      break
    case 'last1d':
      start.setDate(start.getDate() - 1)
      break
    case 'last2d':
      start.setDate(start.getDate() - 2)
      break
    case 'last3d':
      start.setDate(start.getDate() - 3)
      break
    case 'last1w':
      start.setDate(start.getDate() - 7)
      break
    case 'last15d':
      start.setDate(start.getDate() - 15)
      break
    case 'last1m':
      start.setMonth(start.getMonth() - 1)
      break
  }

  return [start.toISOString(), now.toISOString()]
}

/**
 * Builds a WHERE clause for filtering LLM calls based on workspace, time range, and filters.
 *
 * @param params - Filter parameters including workspaceId, timeRange, and filters
 * @returns Prisma SQL WHERE clause
 */
function buildWhereClause(params: {
  workspaceId: string
  timeRange?: [string, string]
  filters: Filters
}): Prisma.Sql {
  const { workspaceId, timeRange, filters } = params
  let whereClause = Prisma.sql`workspace_id = ${workspaceId}`

  // Apply time range filter
  if (timeRange) {
    const [startTime, endTime] = timeRange
    whereClause = Prisma.sql`${whereClause} AND "createdAt" >= ${startTime}::timestamp AND "createdAt" <= ${endTime}::timestamp`
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

  return whereClause
}

export async function selectLlmCalls({
  workspaceId,
  cursor,
  limit,
  filters = { fieldFilters: [] },
  timeRange,
  timeRangePreset,
}: LlmCallsSelectParams): Promise<{
  items: LlmCall[]
  aggregate: AggregateStats
}> {
  // Convert preset to time range if provided
  const effectiveTimeRange =
    timeRangePreset && !timeRange
      ? convertTimeRangePreset(timeRangePreset)
      : timeRange

  // Build base WHERE clause (without cursor)
  const baseWhereClause = buildWhereClause({
    workspaceId,
    timeRange: effectiveTimeRange,
    filters,
  })

  // Build WHERE clause with cursor for paginated results
  let whereClause = baseWhereClause
  if (cursor) {
    whereClause = Prisma.sql`${whereClause} AND "createdAt" < (SELECT "createdAt" FROM responses WHERE id = ${cursor})`
  }

  // Build SQL CASE statements for extracting tokens from provider-specific formats
  const knownProviders = getKnownProviders()
  const {
    inputTokensCase,
    outputTokensCase,
    cacheReadTokensCase,
    cacheWriteTokensCase,
  } = buildTokenCaseStatements(knownProviders)

  // Build aggregate query SQL
  // Price calculation: (tokens / 1M) * (price per 1M tokens)
  // pricing JSON structure: {input, output, cache_read, cache_write}
  const aggregateQuery = `
    SELECT
      COUNT(*) as total_calls,
      SUM(${inputTokensCase}) as total_input_tokens,
      SUM(${outputTokensCase}) as total_output_tokens,
      SUM(${cacheReadTokensCase}) as total_cache_read_tokens,
      SUM(${cacheWriteTokensCase}) as total_cache_write_tokens,
      SUM(
        (${inputTokensCase} / 1000000.0) * COALESCE((pricing->>'input')::numeric, 0) +
        (${outputTokensCase} / 1000000.0) * COALESCE((pricing->>'output')::numeric, 0) +
        (${cacheReadTokensCase} / 1000000.0) * COALESCE((pricing->>'cache_read')::numeric, (pricing->>'input')::numeric, 0) +
        (${cacheWriteTokensCase} / 1000000.0) * COALESCE((pricing->>'cache_write')::numeric, (pricing->>'input')::numeric, 0)
      ) as total_price
    FROM responses
    WHERE `

  // Build complete list query
  const listQuery = `
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
      COALESCE(OCTET_LENGTH("responseBody"), 0) as "responseBodySize",
      (${inputTokensCase})::numeric as "inputTokens",
      (${outputTokensCase})::numeric as "outputTokens",
      (${cacheReadTokensCase})::numeric as "cacheReadTokens",
      (${cacheWriteTokensCase})::numeric as "cacheWriteTokens",
      (
        ((${inputTokensCase})::numeric / 1000000.0) * COALESCE((pricing->>'input')::numeric, 0) +
        ((${outputTokensCase})::numeric / 1000000.0) * COALESCE((pricing->>'output')::numeric, 0) +
        ((${cacheReadTokensCase})::numeric / 1000000.0) * COALESCE((pricing->>'cache_read')::numeric, (pricing->>'input')::numeric, 0) +
        ((${cacheWriteTokensCase})::numeric / 1000000.0) * COALESCE((pricing->>'cache_write')::numeric, (pricing->>'input')::numeric, 0)
      ) as price
    FROM responses
    WHERE ${whereClause.text}
    ORDER BY "createdAt" DESC
    LIMIT ${limit + 1}
  `

  // Run both queries in parallel
  const [results, aggregateResult] = await Promise.all([
    // Query 1: Get paginated list of LLM calls with calculated tokens and price
    prisma.$queryRawUnsafe<any[]>(listQuery, ...whereClause.values),
    // Query 2: Get aggregate statistics (without cursor)
    prisma.$queryRawUnsafe<
      [
        {
          total_calls: bigint
          total_input_tokens: string | null
          total_output_tokens: string | null
          total_cache_read_tokens: string | null
          total_cache_write_tokens: string | null
          total_price: string | null
        },
      ]
    >(aggregateQuery + baseWhereClause.text, ...baseWhereClause.values),
  ])

  // Parse aggregate result
  const aggregate = parseAggregateResult(aggregateResult[0])

  return { items: results, aggregate }
}

// ============================================================================
// Aggregate Query Helpers
// ============================================================================

/**
 * Get usage paths for a specific provider using the provider's parser.
 * Returns null if provider is unknown or doesn't support usage reporting.
 *
 * @param provider - The provider name (e.g., 'anthropic', 'openai')
 * @returns UsagePaths object with paths to token fields, or null if not supported
 */
function getUsagePathsForProvider(provider: string | null): UsagePaths | null {
  if (!provider) return null
  const parser = getParserForProvider(provider)
  if (!parser) return null
  return parser.getUsagePaths()
}

/**
 * Converts a JSON path array to a PostgreSQL JSON path expression.
 * The first element is the column name, rest are JSON keys within that column.
 *
 * @param path - Array of strings representing the JSON path
 * @returns SQL expression to access the field within the usage JSONB column
 *
 * @example
 * jsonPathToSql(['usage', 'input_tokens'])
 * // Returns: 'input_tokens' (to be used as usage->'input_tokens')
 *
 * @example
 * jsonPathToSql(['usage', 'cache_creation', 'ephemeral_1h_input_tokens'])
 * // Returns: 'cache_creation'->'ephemeral_1h_input_tokens'
 */
function jsonPathToSql(path: string[]): string {
  if (path.length === 0) return 'NULL'

  // Skip the first element (column name 'usage') and process the rest
  const jsonPath = path.slice(1)

  if (jsonPath.length === 0) return 'NULL'
  if (jsonPath.length === 1) return `'${jsonPath[0]}'`

  // All elements use single quotes (JSON keys)
  return jsonPath.map(p => `'${p}'`).join('->')
}

/**
 * Extracts the JSON path for a specific token type from provider's usage paths.
 *
 * @param paths - UsagePaths object from provider parser
 * @param tokenType - Type of token to extract path for
 * @returns JSON path array, or undefined if not supported
 */
function getPathForTokenType(
  paths: UsagePaths,
  tokenType: 'input' | 'output' | 'cacheRead' | 'cacheWrite'
): string[] | undefined {
  switch (tokenType) {
    case 'input':
      return paths.inputTokens
    case 'output':
      return paths.outputTokens
    case 'cacheRead':
      return paths.cacheReadTokens
    case 'cacheWrite':
      return paths.cacheWriteTokens
  }
}

/**
 * Generates a SQL CASE statement to extract token values based on provider.
 * Each provider may have different JSON structures for usage data, so we build
 * a CASE statement that handles each provider's specific format.
 *
 * @param tokenType - Type of tokens to extract (input, output, cache read, cache write)
 * @param providers - List of provider names to generate cases for
 * @returns SQL CASE expression that extracts the token count, defaults to 0
 *
 * @example
 * buildTokenCaseStatement('input', ['anthropic', 'openai'])
 * // Returns: CASE WHEN provider = 'anthropic' THEN (usage->"usage"->'input_tokens')::text::numeric
 * //                WHEN provider = 'openai' THEN (usage->"usage"->'prompt_tokens')::text::numeric
 * //                ELSE 0 END
 */
function buildTokenCaseStatement(
  tokenType: 'input' | 'output' | 'cacheRead' | 'cacheWrite',
  providers: string[]
): string {
  const cases: string[] = []

  for (const provider of providers) {
    const paths = getUsagePathsForProvider(provider)
    if (!paths) continue

    const path = getPathForTokenType(paths, tokenType)

    if (path) {
      const sqlPath = jsonPathToSql(path)
      cases.push(
        `WHEN provider = '${provider}' THEN (usage->${sqlPath})::text::numeric`
      )
    }
  }

  // If no providers support this token type, return 0
  if (cases.length === 0) {
    return '0'
  }

  return `CASE ${cases.join(' ')} ELSE 0 END`
}

/**
 * Get list of known providers that support usage reporting.
 * These are providers that have parsers implementing getUsagePaths().
 *
 * @returns Array of provider names
 */
function getKnownProviders(): string[] {
  return ['anthropic', 'openai', 'openai-responses']
}

/**
 * Aggregate statistics for LLM API calls across a workspace.
 */
export interface AggregateStats {
  /** Total number of LLM API calls */
  totalCalls: number
  /** Total input tokens (non-cached) across all calls */
  totalInputTokens: number
  /** Total output/completion tokens across all calls */
  totalOutputTokens: number
  /** Total tokens read from cache across all calls */
  totalCacheReadTokens: number
  /** Total tokens written to cache across all calls */
  totalCacheWriteTokens: number
  /** Total cost in USD across all calls */
  totalPrice: number
}

export interface AggregateParams {
  workspaceId: string
  filters?: Filters
  timeRange?: [string, string]
}

/**
 * Builds SQL CASE statements for extracting token counts from provider-specific usage JSON.
 * Each provider has different JSON structures, so we generate CASE statements that handle
 * each provider's format using their respective parsers' getUsagePaths() method.
 *
 * @param knownProviders - List of providers to generate CASE statements for
 * @returns Object with SQL CASE expressions for each token type
 */
function buildTokenCaseStatements(knownProviders: string[]): {
  inputTokensCase: string
  outputTokensCase: string
  cacheReadTokensCase: string
  cacheWriteTokensCase: string
} {
  return {
    inputTokensCase: buildTokenCaseStatement('input', knownProviders),
    outputTokensCase: buildTokenCaseStatement('output', knownProviders),
    cacheReadTokensCase: buildTokenCaseStatement('cacheRead', knownProviders),
    cacheWriteTokensCase: buildTokenCaseStatement('cacheWrite', knownProviders),
  }
}

/**
 * Parses the database aggregate result row into typed AggregateStats.
 *
 * @param row - Raw database result row with bigint and string numeric values
 * @returns Typed AggregateStats with all numbers converted properly
 */
function parseAggregateResult(row: {
  total_calls: bigint
  total_input_tokens: string | null
  total_output_tokens: string | null
  total_cache_read_tokens: string | null
  total_cache_write_tokens: string | null
  total_price: string | null
}): AggregateStats {
  return {
    totalCalls: Number(row.total_calls),
    totalInputTokens: row.total_input_tokens
      ? Number(row.total_input_tokens)
      : 0,
    totalOutputTokens: row.total_output_tokens
      ? Number(row.total_output_tokens)
      : 0,
    totalCacheReadTokens: row.total_cache_read_tokens
      ? Number(row.total_cache_read_tokens)
      : 0,
    totalCacheWriteTokens: row.total_cache_write_tokens
      ? Number(row.total_cache_write_tokens)
      : 0,
    totalPrice: row.total_price ? Number(row.total_price) : 0,
  }
}

/**
 * Calculate aggregate statistics for LLM calls.
 *
 * This function computes:
 * - Total number of API calls
 * - Total tokens for each type (input, output, cache read, cache write)
 * - Total cost in USD
 *
 * Token counts are extracted using provider-specific JSON paths from each provider's
 * parser (via getUsagePaths()). This ensures we correctly handle different response
 * formats from different LLM providers (Anthropic, OpenAI, etc.).
 *
 * @param params - Parameters including workspaceId, filters, and time range
 * @returns Aggregate statistics for matching LLM calls
 */
export async function aggregateLlmCalls({
  workspaceId,
  filters = { fieldFilters: [] },
  timeRange,
}: AggregateParams): Promise<AggregateStats> {
  // Build WHERE clause using shared helper
  const whereClause = buildWhereClause({
    workspaceId,
    timeRange,
    filters,
  })

  // Build SQL CASE statements for extracting tokens from provider-specific formats
  const knownProviders = getKnownProviders()
  const {
    inputTokensCase,
    outputTokensCase,
    cacheReadTokensCase,
    cacheWriteTokensCase,
  } = buildTokenCaseStatements(knownProviders)

  // Build aggregate query SQL
  // Price calculation: (tokens / 1M) * (price per 1M tokens)
  // pricing JSON structure: {input, output, cache_read, cache_write}
  const aggregateQuery = `
    SELECT
      COUNT(*) as total_calls,
      SUM(${inputTokensCase}) as total_input_tokens,
      SUM(${outputTokensCase}) as total_output_tokens,
      SUM(${cacheReadTokensCase}) as total_cache_read_tokens,
      SUM(${cacheWriteTokensCase}) as total_cache_write_tokens,
      SUM(
        (${inputTokensCase} / 1000000.0) * COALESCE((pricing->>'input')::numeric, 0) +
        (${outputTokensCase} / 1000000.0) * COALESCE((pricing->>'output')::numeric, 0) +
        (${cacheReadTokensCase} / 1000000.0) * COALESCE((pricing->>'cache_read')::numeric, (pricing->>'input')::numeric, 0) +
        (${cacheWriteTokensCase} / 1000000.0) * COALESCE((pricing->>'cache_write')::numeric, (pricing->>'input')::numeric, 0)
      ) as total_price
    FROM responses
    WHERE `

  // Execute aggregate query
  const result = await prisma.$queryRawUnsafe<
    [
      {
        total_calls: bigint
        total_input_tokens: string | null
        total_output_tokens: string | null
        total_cache_read_tokens: string | null
        total_cache_write_tokens: string | null
        total_price: string | null
      },
    ]
  >(aggregateQuery + whereClause.text, ...whereClause.values)

  return parseAggregateResult(result[0])
}
