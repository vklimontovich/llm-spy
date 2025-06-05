import GoogleProvider from "next-auth/providers/google"
import { prisma } from "@/lib/prisma"
import { hash } from "@/lib/hash"
import { NextAuthOptions } from "next-auth"

console.assert(process.env.GOOGLE_CLIENT_SECRET, "GOOGLE_CLIENT_SECRET must be set in environment variables")
console.assert(process.env.GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_ID must be set in environment variables")

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    })
  ],
  secret: process.env.NEXTAUTH_SECRET || hash(process.env.GOOGLE_CLIENT_SECRET!),
  cookies: {
    sessionToken: {
      name: `__llm_monitor_user`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.SECURE_COOKIES === "true" || process.env.SECURE_COOKIES === "1",
      }
    }
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false

      let existingUser = await prisma.user.findUnique({
        where: { email: user.email }
      })

      // If user doesn't exist, check provision rules
      if (!existingUser) {
        // Extract domain from email
        const emailDomain = user.email.split('@')[1].toLowerCase()
        if (!emailDomain) return false

        // Look for domain provision rule
        const provisionRules = await prisma.userProvisionRule.findMany({
          where: { ruleType: 'domain' }
        })

        // Check if any rule matches the user's domain
        //TODO - use query instead of fetching all rules and filtering in memory
        const matchingRule = provisionRules.find(rule => {
          const ruleOptions = rule.ruleOptions as { domain?: string }
          return ruleOptions.domain?.toLowerCase() === `@${emailDomain}`
        })

        if (matchingRule) {
          // Create the user
          existingUser = await prisma.user.create({
            data: { email: user.email }
          })
        }
      }

      return !!existingUser
    }
  }
}