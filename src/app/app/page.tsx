import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { redirectToWorkspace } from '@/lib/workspace-redirect'

export default async function AppRouter() {
  const session = await getServerSession(authOptions)
  await redirectToWorkspace(session)
}
