import type { ParsedAttributeValue, ParsedSpan, ParsedTraces } from './format/otel-types'
export { ParsedTracesSchema, type LLMAttributes, type GenAIAttributes, type ParsedSpan, type ParsedTraces } from './format/otel-types'

// Helper function to extract attribute value from OTEL format
function extractAttributeValue(value: any): ParsedAttributeValue {
  if (value.stringValue !== undefined) return value.stringValue
  if (value.intValue !== undefined) return typeof value.intValue === 'string' ? parseInt(value.intValue) : value.intValue
  if (value.doubleValue !== undefined) return value.doubleValue
  if (value.boolValue !== undefined) return value.boolValue
  if (value.arrayValue?.values) return value.arrayValue.values.map((v: any) => extractAttributeValue(v))
  if (value.kvlistValue?.values) {
    const obj: Record<string, any> = {}
    value.kvlistValue.values.forEach((kv: any) => {
      if (kv.key) obj[kv.key] = extractAttributeValue(kv.value)
    })
    return obj
  }
  if (value.bytesValue !== undefined) return value.bytesValue
  return value
}

// Helper to convert dot notation to nested object
function dotNotationToObject(attributes: Record<string, ParsedAttributeValue>): Record<string, any> {
  const result: Record<string, any> = {}
  
  for (const [key, value] of Object.entries(attributes)) {
    const parts = key.split('.')
    let current = result
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      // Handle array indices in the path (e.g., "prompt.0.role")
      const nextPart = parts[i + 1]
      const isArrayIndex = /^\d+$/.test(nextPart)
      
      if (!current[part]) {
        current[part] = isArrayIndex ? [] : {}
      }
      current = current[part]
    }
    
    const lastPart = parts[parts.length - 1]
    if (Array.isArray(current)) {
      const index = parseInt(lastPart)
      if (!isNaN(index)) {
        current[index] = value
      }
    } else {
      current[lastPart] = value
    }
  }
  
  // Convert sparse arrays to dense arrays
  const convertSparseArrays = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.filter(() => true).map(convertSparseArrays)
    } else if (obj && typeof obj === 'object') {
      const result: any = {}
      for (const [key, value] of Object.entries(obj)) {
        // Check if this object should be an array
        const keys = Object.keys(obj)
        const isArrayLike = keys.every(k => /^\d+$/.test(k))
        if (isArrayLike && key === '0') {
          // Convert to array
          const arr: any[] = []
          keys.forEach(k => {
            arr[parseInt(k)] = convertSparseArrays((obj as any)[k])
          })
          return arr.filter(() => true).map(convertSparseArrays)
        }
        result[key] = convertSparseArrays(value)
      }
      return result
    }
    return obj
  }
  
  return convertSparseArrays(result)
}

// Parse OTEL trace data
export function parseOtelTrace(data: string | object): ParsedTraces {
  let jsonData: any
  
  try {
    jsonData = typeof data === 'string' ? JSON.parse(data) : data
  } catch {
    throw new Error('Invalid JSON data provided')
  }
  
  const parsedSpans: ParsedSpan[] = []
  
  // Process resource spans
  const resourceSpans = jsonData.resourceSpans || []
  for (const resourceSpan of resourceSpans) {
    // Parse resource attributes
    const resourceAttributes: Record<string, ParsedAttributeValue> = {}
    if (resourceSpan.resource?.attributes) {
      for (const attr of resourceSpan.resource.attributes) {
        resourceAttributes[attr.key] = extractAttributeValue(attr.value)
      }
    }
    
    // Process scope spans
    const scopeSpans = resourceSpan.scopeSpans || []
    for (const scopeSpan of scopeSpans) {
      const spans = scopeSpan.spans || []
      for (const span of spans) {
        // Parse span attributes
        const flatAttributes: Record<string, ParsedAttributeValue> = {}
        
        if (span.attributes) {
          for (const attr of span.attributes) {
            flatAttributes[attr.key] = extractAttributeValue(attr.value)
          }
        }
        
        // Convert dot notation to nested structure
        const nestedAttributes = dotNotationToObject(flatAttributes)
        
        // Extract specific attribute groups
        const llmAttributes = nestedAttributes.llm
        const genAiAttributes = nestedAttributes.gen_ai
        
        // Remove structured attributes from general attributes
        delete nestedAttributes.llm
        delete nestedAttributes.gen_ai
        
        // Transform resource attributes with dot notation
        const resourceNested = dotNotationToObject(resourceAttributes)
        
        // Create parsed span
        const parsedSpan: ParsedSpan = {
          name: span.name || '',
          traceId: span.traceId || '',
          spanId: span.spanId || '',
          parentSpanId: span.parentSpanId,
          kind: span.kind,
          startTime: typeof span.startTimeUnixNano === 'string' 
            ? parseInt(span.startTimeUnixNano) 
            : span.startTimeUnixNano || 0,
          endTime: typeof span.endTimeUnixNano === 'string'
            ? parseInt(span.endTimeUnixNano)
            : span.endTimeUnixNano || 0,
          duration: 0, // Will calculate below
          status: span.status,
          attributes: nestedAttributes,
          scope: scopeSpan.scope,
          ...(llmAttributes && { llm: llmAttributes }),
          ...(genAiAttributes && { gen_ai: genAiAttributes }),
          // Flatten resource attributes to top level
          ...resourceNested
        }
        
        // Calculate duration in milliseconds
        parsedSpan.duration = (parsedSpan.endTime - parsedSpan.startTime) / 1_000_000
        
        parsedSpans.push(parsedSpan)
      }
    }
  }
  
  return { spans: parsedSpans }
}

// Re-export the conversion functions from the new location
export { otelSpansToModel } from './format/otel-to-model'

// Legacy exports for backward compatibility (can be removed later)
import type { ModelMessage } from 'ai'
import { otelSpansToModel } from './format/otel-to-model'

export function otelSpansToPromptItems(spans: ParsedSpan[]): ModelMessage[] {
  const model = otelSpansToModel(spans)
  return model.modelMessages
}

export function otelSpansToToolDeclarations(spans: ParsedSpan[]): any[] {
  const model = otelSpansToModel(spans)
  return model.tools.map(t => ({
    name: t.name,
    description: t.description,
    parameters: t.inputSchema
  }))
}