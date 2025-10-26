import { z } from 'zod'

export const clientEnvSchema = z.object({
  // Optional public origin URL for client-side usage
  NEXT_PUBLIC_ORIGIN: z.string().optional(),
})

export type ClientEnv = z.infer<typeof clientEnvSchema>

export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_ORIGIN: process.env.NEXT_PUBLIC_ORIGIN,
})
