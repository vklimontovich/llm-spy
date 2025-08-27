import { z } from 'zod'

export const HeaderSchema = z.object({
  name: z.string(),
  value: z.string(),
  priority: z.enum(['low', 'high']).default('low'),
})

export const UpstreamSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  url: z.string().optional(),
  headers: z.array(HeaderSchema).default([]),
  inputFormat: z.enum(['auto', 'anthropic', 'openai', 'otel']).default('auto'),
  outputFormat: z.enum(['anthropic', 'openai']).nullable().default(null),
  otelUpstreams: z
    .array(
      z.object({
        id: z.string().optional(),
        url: z.string(),
        headers: z.array(HeaderSchema).default([]),
      })
    )
    .default([]),
})

export type Header = z.infer<typeof HeaderSchema>
export type Upstream = z.infer<typeof UpstreamSchema>
