'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Button, Spin } from 'antd'
import { ArrowLeft, Lock } from 'lucide-react'
import { useSession } from 'next-auth/react'
import RequestResponseTabs from '@/components/RequestResponseTabs'
import { RequestResponse } from '@/app/(protected)/requests/page'

export default function SharePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session } = useSession()
  const [selectedRequest, setSelectedRequest] = useState<RequestResponse | null>(null)
  const [activeTab, setActiveTab] = useState<string>('request')

  const requestId = searchParams.get('id')
  const tab = searchParams.get('tab')

  const { data: request, isLoading, error, isError } = useQuery({
    queryKey: ['shared-request', requestId],
    queryFn: async () => {
      if (!requestId) return null
      const response = await fetch(`/api/requests/${requestId}/public`)
      if (!response.ok) {
        if (response.status === 404 || response.status === 403) {
          throw new Error('not_shared')
        }
        throw new Error('Failed to fetch shared request')
      }
      return response.json()
    },
    enabled: !!requestId,
    retry: false
  })

  useEffect(() => {
    if (request) {
      setSelectedRequest(request)
      if (tab) {
        setActiveTab(tab)
      }
    }
  }, [request, tab])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Spin size="large" />
          <div className="text-lg text-gray-600">Loading shared request...</div>
        </div>
      </div>
    )
  }

  if (isError && error?.message === 'not_shared') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <Lock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Not Shared</h2>
          <p className="text-gray-600 mb-6">
            This request is not publicly shared or does not exist.
          </p>
          {session && (
            <Button
              type="primary"
              icon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => router.push('/requests')}
            >
              Go to Requests
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-red-600">Error loading shared request: {(error as Error).message}</div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Request not found or not shared</div>
      </div>
    )
  }

  const handleBackToInternal = () => {
    router.push(`/requests?id=${requestId}&tab=${activeTab}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Shared Request</h1>
              <p className="text-gray-600">View shared HTTP request and response</p>
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
            {selectedRequest && (
              <RequestResponseTabs
                selectedRequest={selectedRequest}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}