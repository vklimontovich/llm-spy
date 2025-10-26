'use client'

import { SessionProvider, useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { WorkspaceProvider } from '@/contexts/WorkspaceContext'
import LoadingScreen from '@/components/LoadingScreen'

interface Workspace {
  id: string
  slug: string
  name: string
  role?: string
}

export default function AuthGuard({
  children,
  workspace,
}: {
  children: React.ReactNode
  workspace: Workspace
}) {
  return (
    <SessionProvider>
      <AuthGuard0 workspace={workspace}>{children}</AuthGuard0>
    </SessionProvider>
  )
}

function AuthGuard0({
  children,
  workspace,
}: {
  children: React.ReactNode
  workspace: Workspace
}) {
  const session = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [redirect, setRedirect] = useState<string>()

  useEffect(() => {
    if (session.status === 'loading') {
      return
    } else if (session.status === 'unauthenticated') {
      if (pathname.startsWith('/api/auth')) {
        // If we're already on an auth page, don't redirect
        return
      }
      const signinPage = '/signin'
      setRedirect(signinPage)
      router.push(signinPage)
    }
  }, [session.status, router, pathname])

  if (session.status === 'loading' || redirect) {
    return <LoadingScreen />
  }

  return <WorkspaceProvider workspace={workspace}>{children}</WorkspaceProvider>
}
