import { z } from 'zod'

export const LlmCallSchema = z.object({
  id: z.string(),
  url: z.string(),
  method: z.string(),
  status: z.number(),
  requestBodySize: z.number(),
  responseBodySize: z.number(),
  responseContentType: z.string(),
  requestHeaders: z.record(z.any()),
  responseHeaders: z.record(z.any()),
  conversationId: z.string().nullable().optional(),
  createdAt: z.string(),
  public: z.boolean().optional(),
  preview: z.string(),
  provider: z.string().nullable().optional(),
  requestModel: z.string().nullable().optional(),
  responseModel: z.string().nullable().optional(),
  usage: z.any().nullable().optional(),
  // Pricing shape is intentionally untyped (any), as requested
  pricing: z.any().nullable().optional(),
  durationMs: z.number().nullable().optional(),
  price: z.number().nullable().optional(),
})

export type LlmCall = z.infer<typeof LlmCallSchema>

// Keep old names for backwards compatibility
export const RequestResponseSchema = LlmCallSchema
export type RequestResponse = LlmCall

// Filter types
export const FilterSchema = z
  .object({
    field: z.string(),
    expr: z.enum(['=']).default('='),
    value: z.string().optional(),
    values: z.array(z.string()).optional(),
  })
  .refine(data => data.value !== undefined || data.values !== undefined, {
    message: 'Either value or values must be provided',
  })

export type Filter = z.infer<typeof FilterSchema>

export const FiltersSchema = z.array(FilterSchema)

export type Filters = z.infer<typeof FiltersSchema>

// Conversation types
export const ConversationSchema = z.object({
  conversationId: z.string(),
  lastLlmCall: z.string(), // ISO date string
  usage: z.any().nullable(),
  totalPrice: z.number().nullable(),
})

export type Conversation = z.infer<typeof ConversationSchema>
