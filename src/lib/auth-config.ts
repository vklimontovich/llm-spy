import GoogleProvider from 'next-auth/providers/google'
import { prisma } from '@/lib/prisma'
import { hash } from '@/lib/hash'
import { NextAuthOptions } from 'next-auth'
import { assertDefined } from '@/lib/preconditions'
import { serverEnv } from '@/lib/server-env'
import { isBuildPhase } from '@/lib/build'

// Lazy getter to avoid evaluating serverEnv values during Next.js build phase
// During build, Next.js analyzes routes which would trigger hash(undefined)
// since serverEnv bypasses validation when NEXT_PHASE=phase-production-build
// We return a dummy config during build that satisfies TypeScript but won't be used
export function getAuthOptions(): NextAuthOptions {
  // During build phase, return minimal valid config to avoid hash(undefined)
  if (isBuildPhase()) {
    return {
      providers: [],
      secret: 'build-time-placeholder',
    }
  }

  // Use APP_ORIGIN for all auth URLs
  const appOrigin = serverEnv.APP_ORIGIN.trim().replace(/\/$/, '')

  // Set NEXTAUTH_URL from APP_ORIGIN
  if (!process.env.NEXTAUTH_URL) {
    process.env.NEXTAUTH_URL = appOrigin
  }

  // Log auth configuration for debugging redirect_uri issues
  console.log('[NextAuth Config]', {
    APP_ORIGIN: appOrigin,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    redirectUri: `${appOrigin}/api/auth/callback/google`,
    nodeEnv: process.env.NODE_ENV,
  })

  const config: NextAuthOptions = {
    pages: {
      signIn: '/signin',
      error: '/signin/error', // Error code passed in query string as ?error=
    },
    providers: [
      GoogleProvider({
        clientId: serverEnv.GOOGLE_CLIENT_ID,
        clientSecret: serverEnv.GOOGLE_CLIENT_SECRET,
        authorization: {
          params: {
            prompt: 'select_account',
          },
        },
      }),
    ],
    secret: serverEnv.NEXTAUTH_SECRET || hash(serverEnv.GOOGLE_CLIENT_SECRET),
    callbacks: {
      async signIn({ user, account }) {
        assertDefined(
          user.email,
          'User email must be defined in signIn callback'
        )

        const provider = account?.provider || 'google'
        const externalUserId = user.id

        // First, lookup by provider and externalUserId
        let existingUser = await prisma.user.findUnique({
          where: {
            provider_externalUserId: {
              provider,
              externalUserId,
            },
          },
        })

        // If not found, check for legacy user (provider = null, externalUserId = null)
        if (!existingUser) {
          existingUser = await prisma.user.findFirst({
            where: {
              email: user.email,
              provider: null,
              externalUserId: null,
            },
          })

          // If found legacy user, update with provider and externalUserId
          if (existingUser) {
            existingUser = await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                provider,
                externalUserId,
              },
            })
          }
        }

        // If still no user, check if signups are enabled
        if (!existingUser) {
          if (!serverEnv.SIGNUP_ENABLED) {
            // Signups are disabled - reject new users
            return false
          }

          existingUser = await prisma.user.create({
            data: {
              email: user.email,
              provider,
              externalUserId,
            },
          })
        }

        return true
      },
      async session({ session, token }) {
        // Ensure the session includes the user's email
        if (token?.email) {
          session.user = session.user || {}
          session.user.email = token.email as string
        }
        return session
      },
      async jwt({ token, user }) {
        // Include user email in JWT token
        if (user?.email) {
          token.email = user.email
        }
        return token
      },
    },
  }

  return config
}
