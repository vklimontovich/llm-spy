'use client'

import { useQuery } from '@tanstack/react-query'
import { Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'

interface Upstream {
  id: string
  name: string
  url: string
  headers: any
  createdAt: string
}

export default function UpstreamsPage() {
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

  const columns: ColumnsType<Upstream> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
    },
    {
      title: 'Headers',
      dataIndex: 'headers',
      key: 'headers',
      render: (headers) => {
        if (!headers || typeof headers !== 'object') return '-'
        return (
          <pre className="text-xs bg-gray-100 p-2 rounded max-w-xs overflow-auto">
            {JSON.stringify(headers, null, 2)}
          </pre>
        )
      }
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString()
    }
  ]

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-600">Error loading upstreams: {error.message}</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Upstreams</h1>
        <p className="text-gray-600">Manage your upstream proxy configurations</p>
      </div>

      <Table
        columns={columns}
        dataSource={upstreams}
        loading={isLoading}
        rowKey="id"
        pagination={false}
        className="bg-white rounded-lg shadow"
      />
    </div>
  )
}