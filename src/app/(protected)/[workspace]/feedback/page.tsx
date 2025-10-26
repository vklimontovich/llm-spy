import { requireAuth } from '@/lib/auth'
import FeedbackPage from '@/components/FeedbackPage'

export default async function Feedback({
  params,
}: {
  params: Promise<{ workspace: string }>
}) {
  const session = await requireAuth()
  const { workspace } = await params

  if (!session?.user?.email) {
    throw new Error('User email is required')
  }

  return (
    <FeedbackPage userEmail={session.user.email} workspaceSlug={workspace} />
  )
}
