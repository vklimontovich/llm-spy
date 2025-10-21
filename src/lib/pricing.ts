// Pricing data fetched from models.dev API

export type ModelPricing = {
  inputPricePerMillion: number
  outputPricePerMillion: number
  provider: string
}

export type PricingInfo = ModelPricing & {
  totalPriceUsd?: number
}

// Cache for pricing data
let pricingCache: Record<string, ModelPricing> | null = null
let lastFetchTime = 0
const CACHE_DURATION = 1000 * 60 * 60 * 24 // 24 hours

type ModelsDevPricing = {
  input?: number
  prompt?: number
  output?: number
  completion?: number
}

type ModelsDevModel = {
  pricing?: ModelsDevPricing
  provider?: { name?: string }
}

type ModelsDevResponse = {
  models?: Record<string, ModelsDevModel> | ModelsDevModel[]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

async function fetchPricingData(): Promise<Record<string, ModelPricing>> {
  try {
    const response = await fetch('https://models.dev/api.json', {
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })

    if (!response.ok) {
      console.warn(`Failed to fetch pricing: ${response.status}`)
      return {}
    }

    const raw = (await response.json()) as unknown
    const data: ModelsDevResponse = isPlainObject(raw) ? (raw as ModelsDevResponse) : {}
    const pricing: Record<string, ModelPricing> = {}

    // Ensure format is as expected before parsing
    const models = data?.models
    if (!models || (typeof models !== 'object' && !Array.isArray(models))) {
      console.warn('models.dev api.json missing or invalid `models` field')
      return {}
    }

    // Normalize to entries for iteration regardless of object/array shape
    const entries: [string, ModelsDevModel][] = Array.isArray(models)
      ? (models as ModelsDevModel[]).map((m, i) => [String(i), m])
      : Object.entries(models as Record<string, ModelsDevModel>)

    // Parse the models.dev data safely
    for (const [modelId, modelData] of entries) {
      if (!isPlainObject(modelData)) continue
      const model = modelData as ModelsDevModel
      if (!isPlainObject(model.pricing) && model.pricing !== undefined) continue

      if (model.pricing) {
        const inputPrice = model.pricing.input ?? model.pricing.prompt ?? 0
        const outputPrice = model.pricing.output ?? model.pricing.completion ?? 0

        // models.dev prices are typically per 1K tokens, convert to per million
        pricing[modelId] = {
          inputPricePerMillion: inputPrice * 1000,
          outputPricePerMillion: outputPrice * 1000,
          provider: model.provider?.name?.toLowerCase() || 'unknown',
        }
      }
    }

    return pricing
  } catch (error) {
    console.warn('Failed to fetch pricing from models.dev:', error)
    return {}
  }
}

async function ensurePricingLoaded(): Promise<Record<string, ModelPricing>> {
  const now = Date.now()

  // Check if cache is still valid
  if (pricingCache && now - lastFetchTime < CACHE_DURATION) {
    return pricingCache
  }

  // Fetch new pricing data
  // If fetching fails, fall back to an empty cache to avoid blocking requests
  pricingCache = await fetchPricingData()
  lastFetchTime = now
  return pricingCache
}

export async function getModelPricing(
  modelName: string
): Promise<PricingInfo | null> {
  const pricing = await ensurePricingLoaded()

  // Only exact match, no normalization
  if (pricing[modelName]) {
    return { ...pricing[modelName] }
  }

  return null
}

export function calculatePrice(
  pricing: PricingInfo,
  inputTokens: number,
  outputTokens: number
): number {
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMillion
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePerMillion
  return inputCost + outputCost
}

export async function getPricingForUsage(
  modelName: string,
  inputTokens: number,
  outputTokens: number
): Promise<{ pricing: PricingInfo; totalPriceUsd: number } | null> {
  const pricing = await getModelPricing(modelName)
  if (!pricing) return null

  const totalPriceUsd = calculatePrice(pricing, inputTokens, outputTokens)
  return {
    pricing: {
      ...pricing,
      totalPriceUsd,
    },
    totalPriceUsd,
  }
}

// Preload pricing on module import (non-blocking)
ensurePricingLoaded().catch(err =>
  console.warn('Failed to preload pricing data:', err)
)
