// Minimal pricing loader: returns raw cost per 1K tokens per model.

import { Usage } from '@/lib/format/model'

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

/**
 * Computes the total price in USD for an LLM call
 * @param pricing - Pricing data for the model (from getPricing)
 * @param usage - Standardized usage data (from parser.getUsage)
 * @param modelId - Optional model ID for keyed pricing lookups
 * @returns Total price in USD, or null if pricing unavailable
 */
export function computePriceUsd(
  modelId: string,
  pricing: any,
  usage: Usage,
): number | null {

  const isObj = (v: any) => v && typeof v === 'object' && !Array.isArray(v)
  let cost: any = null

  // Handle keyed pricing (multiple models in one pricing object)
  if (isObj(pricing)) {
    const keys = Object.keys(pricing)
    const looksKeyed = keys.some(k => isObj((pricing as any)[k]))
    if (looksKeyed) {
      const rec = pricing as Record<string, any>
      const key = modelId && rec[modelId] ? modelId : keys[0]
      cost = rec[key]
    } else {
      cost = pricing
    }
  }

  if (!cost) return null

  const inTokens = usage.inputTokens
  const outTokens = usage.outputTokens
  const rdTokens = usage.cacheReadTokens || 0
  const wrTokens = usage.cacheWriteTokens || 0

  // Calculate total cost (prices are per 1M tokens)
  const total =
    (inTokens / 1_000_000) * (Number(cost.input) || 0) +
    (rdTokens / 1_000_000) * (Number(cost.cache_read) || Number(cost.input) || 0) +
    (wrTokens / 1_000_000) * (Number(cost.cache_write) || Number(cost.input) || 0) +
    (outTokens / 1_000_000) * (Number(cost.output) || 0)

  return total
}
