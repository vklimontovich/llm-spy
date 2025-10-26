import { z } from 'zod'

export const frontendAppConfigSchema = z.object({
  origin: z.string().url(),
  apiOrigin: z.string().url(),
  isSecure: z.boolean(),
  feedbackEnabled: z.boolean(),
})

export type FrontendAppConfig = z.infer<typeof frontendAppConfigSchema>
