import { getServerSession } from 'next-auth'
import { getAuthOptions } from '@/lib/auth-config'
import { redirectToWorkspace } from '@/lib/workspace-redirect'

export default async function AppRouter() {
  const session = await getServerSession(getAuthOptions())
  await redirectToWorkspace(session)
}
