import { z } from 'zod'

export const RequestResponseSchema = z.object({
  id: z.string(),
  url: z.string(),
  method: z.string(),
  status: z.number(),
  requestBodySize: z.number(),
  responseBodySize: z.number(),
  responseContentType: z.string(),
  requestHeaders: z.record(z.any()),
  responseHeaders: z.record(z.any()),
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
})

export type RequestResponse = z.infer<typeof RequestResponseSchema>
