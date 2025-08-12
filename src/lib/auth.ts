import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-config"

export async function getSession() {
  return await getServerSession(authOptions)
}

export async function requireAuth() {
  const session = await getSession()

  if (!session?.user?.email) {
    console.log("Session not found or user email is missing", session)
    throw new Error("Unauthorized")
  }

  return session
}

export async function hasAuth() {
  const session = await getSession()
  return !!session?.user?.email

}
