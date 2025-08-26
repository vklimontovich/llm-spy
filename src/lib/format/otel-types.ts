import { z } from 'zod'

// Parsed attribute value (after conversion from protobuf format)
export type ParsedAttributeValue = string | number | boolean | any[] | Record<string, any>

// LLM-specific attributes
export const LLMAttributesSchema = z.object({
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
export const GenAIAttributesSchema = z.object({
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
export const ParsedSpanSchema = z.object({
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