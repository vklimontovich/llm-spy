import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'

export default async function Home({params}: {params: Promise<{workspace: string}>}) {
  await requireAuth()
  const { workspace } = await params
  redirect(`/${workspace}/upstreams`)
}