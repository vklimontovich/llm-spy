import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-config"

export async function getSession() {
  return await getServerSession(authOptions)
}

export async function requireAuth() {
  const session = await getSession()
  
  if (!session?.user?.email) {
    throw new Error("Unauthorized")
  }
  
  return session
}