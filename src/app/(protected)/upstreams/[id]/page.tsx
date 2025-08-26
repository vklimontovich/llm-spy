'use client'

import { useParams } from 'next/navigation'
import UpstreamEditor from '@/components/UpstreamEditor'

export default function UpstreamEditPage() {
  const params = useParams()
  const id = params.id as string

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {id === 'new' ? 'Create Upstream' : 'Edit Upstream'}
        </h1>
        <p className="text-gray-600">
          {id === 'new' 
            ? 'Configure a new upstream proxy destination' 
            : 'Update upstream configuration and OpenTelemetry collectors'}
        </p>
      </div>
      
      <UpstreamEditor id={id} />
    </div>
  )
}