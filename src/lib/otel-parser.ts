import { z } from 'zod'

// Parsed attribute value (after conversion from protobuf format)
type ParsedAttributeValue = string | number | boolean | any[] | Record<string, any>

// LLM-specific attributes
const LLMAttributesSchema = z.object({
  request: z.object({
    type: z.string().optional(),
    model: z.string().optional(),
    functions: z.array(z.object({
      name: z.string(),
      description: z.string().optional(),
      parameters: z.any().optional()
    })).optional()
  }).optional(),
  response: z.object({
    model: z.string().optional(),
    id: z.string().optional(),
    finish_reason: z.string().optional()
  }).optional(),
  prompt: z.array(z.object({
    role: z.string(),
    content: z.string().optional(),
    tool_calls: z.array(z.object({
      id: z.string(),
      name: z.string(),
      arguments: z.string()
    })).optional()
  })).optional(),
  usage: z.object({
    total_tokens: z.number().optional(),
    prompt_tokens: z.number().optional(),
    completion_tokens: z.number().optional()
  }).optional(),
  headers: z.string().optional(),
  is_streaming: z.boolean().optional()
}).passthrough() // Allow additional properties

// GenAI-specific attributes
const GenAIAttributesSchema = z.object({
  system: z.string().optional(),
  request: z.object({
    model: z.string().optional(),
    functions: z.array(z.object({
      name: z.string(),
      description: z.string().optional(),
      parameters: z.any().optional()
    })).optional()
  }).optional(),
  response: z.object({
    model: z.string().optional(),
    id: z.string().optional()
  }).optional(),
  prompt: z.array(z.object({
    role: z.string(),
    content: z.string().optional(),
    tool_calls: z.array(z.object({
      id: z.string(),
      name: z.string(),
      arguments: z.string()
    })).optional()
  })).optional(),
  completion: z.array(z.object({
    role: z.string().optional(),
    content: z.string().optional(),
    finish_reason: z.string().optional(),
    tool_calls: z.array(z.object({
      id: z.string(),
      name: z.string(),
      arguments: z.string()
    })).optional()
  })).optional(),
  usage: z.object({
    prompt_tokens: z.number().optional(),
    completion_tokens: z.number().optional()
  }).optional(),
  openai: z.object({
    api_base: z.string().optional(),
    system_fingerprint: z.string().optional()
  }).optional()
}).passthrough() // Allow additional properties

// Parsed span with structured attributes
const ParsedSpanSchema = z.object({
  name: z.string(),
  traceId: z.string(),
  spanId: z.string(),
  parentSpanId: z.string().optional(),
  kind: z.string().optional(),
  startTime: z.number(),
  endTime: z.number(),
  duration: z.number(),
  status: z.object({
    code: z.union([z.string(), z.number()]).optional(),
    message: z.string().optional()
  }).optional(),
  llm: LLMAttributesSchema.optional(),
  gen_ai: GenAIAttributesSchema.optional(),
  attributes: z.record(z.any()),
  resource: z.record(z.any()).optional(),
  scope: z.object({
    name: z.string(),
    version: z.string().optional()
  }).optional()
}).passthrough() // Allow custom properties

// Parsed traces result
export const ParsedTracesSchema = z.object({
  spans: z.array(ParsedSpanSchema)
})

// Export types
export type LLMAttributes = z.infer<typeof LLMAttributesSchema>
export type GenAIAttributes = z.infer<typeof GenAIAttributesSchema>
export type ParsedSpan = z.infer<typeof ParsedSpanSchema>
export type ParsedTraces = z.infer<typeof ParsedTracesSchema>

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

import type { PromptItem } from './content-utils'

// Transform OTEL spans to prompt items for display
export function otelSpansToPromptItems(spans: ParsedSpan[]): PromptItem[] {
  const prompts: PromptItem[] = []

  // Collect prompts from all spans
  for (const span of spans) {
    // Extract prompts from gen_ai attributes
    if (span.gen_ai?.prompt && Array.isArray(span.gen_ai.prompt)) {
      for (const prompt of span.gen_ai.prompt) {
        // Check if this prompt has both content AND tool_calls (assistant messages between tool calls)
        if (prompt.content && prompt.tool_calls && Array.isArray(prompt.tool_calls)) {
          // First add the content as a regular message
          prompts.push({
            role: prompt.role === 'tool' ? 'tool result' : prompt.role,
            content: prompt.content
          })
          
          // Then add the tool calls
          const toolCallContents = prompt.tool_calls.map(tc => ({
            type: 'tool_use' as const,
            toolName: tc.name,
            toolId: tc.id,
            content: tc.arguments
          }))
          
          prompts.push({
            role: prompt.role,
            content: toolCallContents,
            type: 'text'
          })
        } else if (prompt.tool_calls && Array.isArray(prompt.tool_calls)) {
          // Just tool calls without content
          const toolCallContents = prompt.tool_calls.map(tc => ({
            type: 'tool_use' as const,
            toolName: tc.name,
            toolId: tc.id,
            content: tc.arguments
          }))
          
          prompts.push({
            role: prompt.role === 'tool' ? 'tool result' : prompt.role,
            content: toolCallContents,
            type: 'text'
          })
        } else {
          // Regular text prompt
          prompts.push({
            role: prompt.role === 'tool' ? 'tool result' : prompt.role,
            content: prompt.content || '',
            ...(prompt.role === 'tool' && { type: 'tool_result' as const })
          })
        }
      }
    }
    
    // Extract completions from gen_ai attributes
    if (span.gen_ai?.completion && Array.isArray(span.gen_ai.completion)) {
      for (const completion of span.gen_ai.completion) {
        // Check if this completion has both content AND tool_calls
        if (completion.content && completion.tool_calls && Array.isArray(completion.tool_calls)) {
          // First add the content as a regular message
          prompts.push({
            role: completion.role || 'assistant',
            content: completion.content
          })
          
          // Then add the tool calls
          const toolCallContents = completion.tool_calls.map(tc => ({
            type: 'tool_use' as const,
            toolName: tc.name,
            toolId: tc.id,
            content: tc.arguments
          }))
          
          prompts.push({
            role: completion.role || 'assistant',
            content: toolCallContents,
            type: 'text'
          })
        } else if (completion.tool_calls && Array.isArray(completion.tool_calls)) {
          // Just tool calls without content
          const toolCallContents = completion.tool_calls.map(tc => ({
            type: 'tool_use' as const,
            toolName: tc.name,
            toolId: tc.id,
            content: tc.arguments
          }))
          
          prompts.push({
            role: completion.role || 'assistant',
            content: toolCallContents,
            type: 'text'
          })
        } else if (completion.content) {
          // Regular completion content
          prompts.push({
            role: completion.role || 'assistant',
            content: completion.content
          })
        }
      }
    }
    
    // Extract prompts from llm attributes
    if (span.llm?.prompt && Array.isArray(span.llm.prompt)) {
      for (const prompt of span.llm.prompt) {
        // Handle tool calls
        if (prompt.tool_calls && Array.isArray(prompt.tool_calls)) {
          // Create a single prompt item with tool calls as content array
          const toolCallContents = prompt.tool_calls.map(tc => ({
            type: 'tool_use' as const,
            toolName: tc.name,
            toolId: tc.id,
            content: tc.arguments
          }))
          
          prompts.push({
            role: prompt.role === 'tool' ? 'tool result' : prompt.role,
            content: toolCallContents,
            type: 'text'
          })
        } else {
          // Regular text prompt
          prompts.push({
            role: prompt.role === 'tool' ? 'tool result' : prompt.role,
            content: prompt.content || '',
            ...(prompt.role === 'tool' && { type: 'tool_result' as const })
          })
        }
      }
    }
  }

  return prompts
}

// Extract tool declarations from OTEL spans
export function otelSpansToToolDeclarations(spans: ParsedSpan[]): any[] {
  for (const span of spans) {
    // Check in llm.request.functions
    if (span.llm?.request?.functions && Array.isArray(span.llm.request.functions)) {
      return span.llm.request.functions
    }
    
    // Check in gen_ai attributes if not found in llm
    if (span.gen_ai?.request?.functions && Array.isArray(span.gen_ai.request.functions)) {
      return span.gen_ai.request.functions
    }
  }
  
  return []
}