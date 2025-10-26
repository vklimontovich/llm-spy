import { getServerSession } from 'next-auth'
import { getAuthOptions } from '@/lib/auth-config'
import { redirectToWorkspace } from '@/lib/workspace-redirect'
import SignInClient from './client'

export default async function SignInPage() {
  const session = await getServerSession(getAuthOptions())

  // If already logged in, redirect to workspace
  if (session && session.user?.email) {
    await redirectToWorkspace(session)
  }

  return <SignInClient />
}
