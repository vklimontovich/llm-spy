import { z } from 'zod'

export const KeySchema = z.object({
  id: z.string(),
  hashed: z.boolean(),
  hint: z.string(),
  createdAt: z.string().optional(),
})

export type Key = z.infer<typeof KeySchema>
