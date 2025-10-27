'use client'

import { Button } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useParams, useRouter } from 'next/navigation'
import UpstreamList from '@/components/UpstreamList'
import GettingStarted from '@/components/GettingStarted'

export default function UpstreamsPage() {
  const router = useRouter()
  const params = useParams()

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

      <UpstreamList />

      <GettingStarted header="How to Connect" />
    </div>
  )
}
