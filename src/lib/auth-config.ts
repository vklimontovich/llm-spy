import GoogleProvider from 'next-auth/providers/google'
import { prisma } from '@/lib/prisma'
import { hash } from '@/lib/hash'
import { NextAuthOptions } from 'next-auth'
import { assertDefined } from '@/lib/preconditions'

console.assert(
  process.env.GOOGLE_CLIENT_SECRET,
  'GOOGLE_CLIENT_SECRET must be set in environment variables'
)
console.assert(
  process.env.GOOGLE_CLIENT_ID,
  'GOOGLE_CLIENT_ID must be set in environment variables'
)

export const authOptions: NextAuthOptions = {
  pages: {
    signIn: '/signin',
    error: '/signin/error', // Error code passed in query string as ?error=
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'select_account',
        },
      },
    }),
  ],
  secret:
    process.env.NEXTAUTH_SECRET || hash(process.env.GOOGLE_CLIENT_SECRET!),
  callbacks: {
    async signIn({ user, account }) {
      assertDefined(user.email, 'User email must be defined in signIn callback')

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

      // If still no user, create new user
      if (!existingUser) {
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
