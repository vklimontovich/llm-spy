import { getServerSession } from 'next-auth'
import { getAuthOptions } from '@/lib/auth-config'
import LandingPage from '@/components/LandingPage'
import { serverEnv } from '@/lib/server-env'
import { redirectToWorkspace } from '@/lib/workspace-redirect'

export default async function Home() {
  const session = await getServerSession(getAuthOptions())
  if (serverEnv.LANDING_PAGE_ENABLED) {
    return <LandingPage loggedIn={!!session} />
  } else {
    await redirectToWorkspace(session)
  }
}
