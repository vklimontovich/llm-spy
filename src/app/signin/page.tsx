import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { redirectToWorkspace } from '@/lib/workspace-redirect'
import SignInClient from './client'

export default async function SignInPage() {
  const session = await getServerSession(authOptions)

  // If already logged in, redirect to workspace
  if (session) {
    await redirectToWorkspace(session)
  }

  return <SignInClient />
}
