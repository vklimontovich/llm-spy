'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { Button, Spin } from 'antd'
import { ArrowLeft } from 'lucide-react'
import { useSession } from 'next-auth/react'
import RequestView from '@/components/RequestView'

function SharePageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session } = useSession()

  const requestId = searchParams.get('id')

  if (!requestId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">No request ID provided</div>
      </div>
    )
  }

  const handleBackToInternal = () => {
    const tab = searchParams.get('tab') || 'chat'
    router.push(`/requests?id=${requestId}&tab=${tab}`)
  }

  return (
    <div className="min-h-screen">
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Shared Request</h1>
          </div>
          {session && (
            <Button
              type="primary"
              icon={<ArrowLeft className="w-4 h-4" />}
              onClick={handleBackToInternal}
            >
              Back to Internal View
            </Button>
          )}
        </div>

        <div className="border-t pt-4">
          <RequestView requestId={requestId} />
        </div>
      </div>
    </div>
  )
}

export default function SharePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spin size="large" />
          <div className="text-lg text-gray-600">Loading...</div>
        </div>
      </div>
    }>
      <SharePageContent />
    </Suspense>
  )
}