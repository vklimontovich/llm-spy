import { z } from 'zod'
import { validateUpstreamName } from './model/validation'
import { validatePublicUrl } from './url-validation'

export const HeaderSchema = z.object({
  name: z.string(),
  value: z.string(),
  priority: z.enum(['low', 'high']).default('low'),
})

export const UpstreamSchema = z.object({
  id: z.string().optional(),
  name: z.string().refine(
    name => {
      const result = validateUpstreamName(name)
      return result.valid
    },
    name => {
      const result = validateUpstreamName(name)
      return {
        message:
          result.error ||
          'Name must start with a letter or underscore, and can only contain letters, numbers, and underscores',
      }
    }
  ),
  url: z
    .string()
    .optional()
    .refine(
      url => !url || validatePublicUrl(url).valid,
      url => ({
        message:
          validatePublicUrl(url!).error || 'Invalid URL: must be a public URL',
      })
    ),
  headers: z.array(HeaderSchema).default([]),
  inputFormat: z.enum(['auto', 'anthropic', 'openai', 'otel']).default('auto'),
  outputFormat: z.enum(['anthropic', 'openai']).nullable().default(null),
  keepAuthHeaders: z.boolean().default(false),
  otelUpstreams: z
    .array(
      z.object({
        id: z.string().optional(),
        url: z.string().refine(
          url => validatePublicUrl(url).valid,
          url => ({
            message:
              validatePublicUrl(url).error ||
              'Invalid URL: must be a public URL',
          })
        ),
        headers: z.array(HeaderSchema).default([]),
      })
    )
    .default([]),
})

export type Header = z.infer<typeof HeaderSchema>
export type Upstream = z.infer<typeof UpstreamSchema>
