import { z } from 'zod'
import { clientEnvSchema } from '@/lib/client-env'
import { isBuildPhase } from '@/lib/build'

const serverOnlyEnvSchema = z.object({
  // Node environment (development, production, test)
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Google OAuth client ID - get from Google Cloud Console
  GOOGLE_CLIENT_ID: z.string().min(1),

  // Google OAuth client secret - get from Google Cloud Console
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  // Optional API origin if different from app URL
  API_ORIGIN: z.string().url().optional(),

  // Optional app origin URL (e.g., https://your-domain.com) - used for NextAuth and other purposes
  APP_ORIGIN: z.string().url().optional(),

  // Optional secret for NextAuth - if not set, will hash Google secrets
  NEXTAUTH_SECRET: z.string().optional(),

  // Set to 'true' to disable authentication (not recommended for production)
  DISABLE_AUTHENTICATION: z.coerce.boolean().optional().default(false),

  // Set to 'true' to enable feedback feature
  FEEDBACK_ENABLED: z.coerce.boolean().optional().default(false),

  // Set to true to show the landing page
  LANDING_PAGE_ENABLED: z.coerce.boolean().optional().default(false),

  // Set to true for initial deploy to create user account, then set to false
  SIGNUP_ENABLED: z.coerce.boolean().optional().default(false),

  // Set to 'true' to enable upstream URL validation (blocks private IPs and internal hostnames)
  VALIDATE_UPSTREAM_URL: z.coerce.boolean().optional().default(false),
})

const serverEnvSchema = clientEnvSchema.merge(serverOnlyEnvSchema)

export type ServerEnv = z.infer<typeof serverEnvSchema>

// Skip validation during Next.js build phase to avoid requiring real credentials
// During build, Next.js analyzes routes which causes this module to execute
// isBuildPhase() checks if NEXT_PHASE=phase-production-build
export const serverEnv = isBuildPhase()
  ? (process.env as any) // bypass type checking during build
  : serverEnvSchema.parse(process.env)
