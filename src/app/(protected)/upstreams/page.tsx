'use client'

import { useQuery } from '@tanstack/react-query'
import { Button } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import UpstreamList from '@/components/UpstreamList'

export default function UpstreamsPage() {
  const router = useRouter()
  
  const { data: upstreams, isLoading, error } = useQuery({
    queryKey: ['upstreams'],
    queryFn: async () => {
      const response = await fetch('/api/upstreams')
      if (!response.ok) {
        throw new Error('Failed to fetch upstreams')
      }
      return response.json()
    }
  })

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-600">Error loading upstreams: {error.message}</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Upstreams</h1>
          <p className="text-gray-600">Manage your upstream proxy configurations</p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => router.push('/upstreams/new')}
        >
          Add Upstream
        </Button>
      </div>

      <UpstreamList upstreams={upstreams || []} isLoading={isLoading} />
    </div>
  )
}