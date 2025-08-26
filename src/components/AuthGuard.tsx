'use client'

import { SessionProvider, useSession } from 'next-auth/react'
import { useRouter, usePathname, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { WorkspaceProvider } from '@/contexts/WorkspaceContext'
import LoadingScreen from '@/components/LoadingScreen'
import axios from 'axios'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  return <SessionProvider>
    <AuthGuard0>
      {children}
    </AuthGuard0>
  </SessionProvider>
}

function AuthGuard0({ children }: { children: React.ReactNode }) {
  const session = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const [redirect, setRedirect] = useState<string>()
  const [workspace, setWorkspace] = useState<{ id: string, slug: string, name: string, role?: string } | null>(null)
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  console.log('pathname', pathname)

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
    } else if (session.status === 'authenticated') {
      // If we have a workspace parameter, fetch workspace details
      if (params.workspace && typeof params.workspace === 'string') {
        setError(null)

        axios.get(`/api/workspaces/${params.workspace}`)
          .then(response => {
            setWorkspace(response.data)
            setWorkspaceLoaded(true)
          })
          .catch(error => {
            setError(error.response?.data?.error || 'Failed to fetch workspace')
            console.error(`Failed to fetch workspace ${params.workspace}`, error)
          })
      } else {
        setWorkspaceLoaded(true)
      }
    } else {
      throw new Error('Unexpected session status: ' + session.status)
    }
  }, [session.status, router, pathname, params.workspace])

  if (session.status === 'loading' || redirect || !workspaceLoaded) {
    return <LoadingScreen />
  } else if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">Error: {error}</div>
      </div>
    )
  } else {
    return (
      workspace ? <WorkspaceProvider workspace={workspace}>
        {children}
      </WorkspaceProvider> : <>{children}</>
    )
  }
}