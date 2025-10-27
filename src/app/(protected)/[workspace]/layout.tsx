import AuthGuard from '@/components/AuthGuard'
import WorkspaceHeader from '@/components/WorkspaceHeader'
import { getSession, requireWorkspaceAccess } from '@/lib/auth'
import { requireDefined } from '@/lib/preconditions'
import { setupWorkspace } from '@/lib/setup-workspace'
import { redirect } from 'next/navigation'

export default async function ProtectedAuthLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ workspace: string }>
}>) {
  // Get session server-side
  const session = await getSession()

  // If no session or no email, redirect to signin
  if (!session || !session.user?.email) {
    redirect('/signin')
  }

  const userEmail = requireDefined(session.user.email, 'User email is required')

  // Get workspace details and verify access
  const { workspace: workspaceSlug } = await params
  const workspace = await requireWorkspaceAccess(workspaceSlug, userEmail)

  // Setup workspace (create default upstreams and keys if needed)
  await setupWorkspace({ workspace })

  return (
    <AuthGuard workspace={workspace}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <WorkspaceHeader workspaceSlug={workspace.slug} userEmail={userEmail} />

        {/* Main Content */}
        <main className="w-full min-w-[1024px]">
          <div className="max-w-[1900px] mx-auto">{children}</div>
        </main>
      </div>
    </AuthGuard>
  )
}
