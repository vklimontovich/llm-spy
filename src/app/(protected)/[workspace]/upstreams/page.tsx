'use client'

import { useQuery } from '@tanstack/react-query'
import { Button } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useRouter, useParams } from 'next/navigation'
import UpstreamList from '@/components/UpstreamList'
import GettingStarted from '@/components/GettingStarted'
import { useWorkspaceApi } from '@/lib/api'

export default function UpstreamsPage() {
  const router = useRouter()
  const params = useParams()
  const api = useWorkspaceApi()

  const {
    data: upstreams,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['upstreams'],
    queryFn: async () => {
      const response = await api.get('/upstreams')
      return response.data
    },
  })

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-600">
          Error loading upstreams: {error.message}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Upstreams</h1>
          <p className="text-gray-600">
            Manage your upstream proxy configurations
          </p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => router.push(`/${params.workspace}/upstreams/new`)}
        >
          Add Upstream
        </Button>
      </div>

      <UpstreamList upstreams={upstreams || []} isLoading={isLoading} />

      <GettingStarted header="How to Connect" upstreams={upstreams || []} />
    </div>
  )
}
