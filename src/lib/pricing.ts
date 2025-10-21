// Minimal pricing loader: returns raw cost per 1K tokens per model.

async function fetchPricingData(): Promise<any> {
  try {
    const response = await fetch('https://models.dev/api.json', {
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) {
      console.warn(`Failed to fetch pricing: ${response.status}`)
      return {}
    }

    const data: any = await response.json()
    const result: Record<string, any> = {}

    const isObj = (v: any) => v && typeof v === 'object' && !Array.isArray(v)

    // Case 1: provider map at root
    if (isObj(data)) {
      for (const [, providerVal] of Object.entries<any>(data)) {
        const providerModels = providerVal?.models
        if (!isObj(providerModels)) continue
        for (const [modelId, modelVal] of Object.entries<any>(providerModels)) {
          const cost = modelVal?.cost
          if (isObj(cost)) {
            result[modelId] = { ...cost }
          }
        }
      }
    }

    // Case 2: legacy: top-level models
    if (Object.keys(result).length === 0 && isObj(data?.models)) {
      for (const [modelId, modelVal] of Object.entries<any>(data.models)) {
        const cost = (modelVal as any)?.cost
        if (isObj(cost)) {
          result[modelId] = { ...cost }
        }
      }
    }

    return result
  } catch (error) {
    console.warn('Failed to fetch pricing from models.dev:', error)
    return {}
  }
}

// Simple per-model cache
let MODEL_CACHE: Record<string, any> | null = null
let LAST_FETCH = 0
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 // 24h

export async function getPricing(model: string): Promise<any> {
  const now = Date.now()
  if (!MODEL_CACHE || now - LAST_FETCH > CACHE_TTL_MS) {
    MODEL_CACHE = await fetchPricingData()
    LAST_FETCH = now
  }
  return MODEL_CACHE?.[model] ?? null
}
