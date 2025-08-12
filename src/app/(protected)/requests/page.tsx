'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Table, Button, Switch } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {  useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import RequestDetails from '@/components/RequestDetails'
import { extractSessionId } from '@/lib/session-utils'
import { RefreshCw } from 'lucide-react'
import styles from './page.module.css'

const PAGE_SIZE = 100


export interface RequestResponse {
  id: string
  url: string
  method: string
  status: number
  requestBodySize: number
  responseBodySize: number
  responseContentType: string
  requestHeaders: any
  responseHeaders: any
  createdAt: string
  public?: boolean
}

export default function RequestsPage() {
  const [selectedRequest, setSelectedRequest] = useState<RequestResponse | null>(null)
  const [activeTab, setActiveTab] = useState<string>('request')
  const [liveRefresh, setLiveRefresh] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['requests', offset],
    queryFn: async () => {
      const url = new URL('/api/requests', window.location.origin)
      url.searchParams.set('limit', PAGE_SIZE.toString())
      url.searchParams.set('offset', offset.toString())

      const response = await fetch(url.toString())
      if (!response.ok) {
        throw new Error('Failed to fetch requests')
      }
      const result = await response.json()
      setHasMore(result.items && result.items.length === PAGE_SIZE)
      return result
    }
  })

  // Update last refreshed when data changes
  useEffect(() => {
    if (data) {
      setLastRefreshed(new Date())
    }
  }, [data])

  const handleRefresh = () => {
    setOffset(0)
    setAllRequests([])
    setHasMore(true)
    queryClient.invalidateQueries({ queryKey: ['requests'] })
    refetch()
  }

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore) return

    setLoadingMore(true)
    const newOffset = offset + PAGE_SIZE
    setOffset(newOffset)
    setLoadingMore(false)
  }

  const [allRequests, setAllRequests] = useState<RequestResponse[]>([])

  useEffect(() => {
    if (data?.items) {
      if (offset === 0) {
        setAllRequests(data.items)
      } else {
        setAllRequests(prev => [...prev, ...data.items])
      }
    }
  }, [data, offset])

  // Handle URL params on mount
  useEffect(() => {
    const requestId = searchParams.get('id')
    const tab = searchParams.get('tab')

    if (requestId && allRequests.length > 0) {
      const request = allRequests.find(req => req.id === requestId)
      if (request) {
        setSelectedRequest(request)
        if (tab) {
          setActiveTab(tab)
        }
      }
    }
  }, [searchParams, allRequests])

  // Update URL when request/tab changes
  const updateUrl = (requestId: string | null, tabKey?: string) => {
    const params = new URLSearchParams()
    if (requestId) {
      params.set('id', requestId)
      if (tabKey) {
        params.set('tab', tabKey)
      }
    }
    const newUrl = params.toString() ? `/requests?${params.toString()}` : '/requests'
    router.push(newUrl, { scroll: false })
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i]
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    let timeAgo = ''
    if (days > 0) {
      timeAgo = `${days}d ago`
    } else if (hours > 0) {
      timeAgo = `${hours}h ago`
    } else if (minutes > 0) {
      timeAgo = `${minutes}m ago`
    } else {
      timeAgo = `${seconds}s ago`
    }

    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const hoursFormatted = String(date.getUTCHours()).padStart(2, '0')
    const minutesFormatted = String(date.getUTCMinutes()).padStart(2, '0')
    const secondsFormatted = String(date.getUTCSeconds()).padStart(2, '0')
    return {
      full: `${year}-${month}-${day} ${hoursFormatted}:${minutesFormatted}:${secondsFormatted} UTC`,
      ago: timeAgo
    }
  }

  // No infinite scroll - just display last 500 messages

  const columns: ColumnsType<RequestResponse> = [
    {
      title: 'Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 240,
      render: (date) => {
        const formatted = formatDate(date)
        return (
          <span className="text-xs font-mono whitespace-nowrap">
            {formatted.full} <span className="text-gray-500">({formatted.ago})</span>
          </span>
        )
      }
    },
    {
      title: 'Method',
      dataIndex: 'method',
      key: 'method',
      width: 70,
      render: (method) => (
        <span className={`px-1 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
          method === 'GET' ? 'bg-green-100 text-green-800' :
          method === 'POST' ? 'bg-blue-100 text-blue-800' :
          method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
          method === 'DELETE' ? 'bg-red-100 text-red-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {method}
        </span>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 60,
      render: (status) => (
        <span className={`px-1 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
          status >= 200 && status < 300 ? 'bg-green-100 text-green-800' :
          status >= 300 && status < 400 ? 'bg-blue-100 text-blue-800' :
          status >= 400 && status < 500 ? 'bg-yellow-100 text-yellow-800' :
          status >= 500 ? 'bg-red-100 text-red-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {status}
        </span>
      )
    },
    {
      title: 'Session',
      key: 'sessionId',
      width: 100,
      render: (_, record) => {
        const sessionId = extractSessionId(record.requestHeaders)
        if (!sessionId) return <span className="text-xs text-gray-400">-</span>

        // Show first 8 chars of session ID
        const shortId = sessionId.substring(0, 8)
        return (
          <span className="text-xs font-mono text-blue-600" title={sessionId}>
            {shortId}
          </span>
        )
      }
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      render: (url) => (
        <span className="text-xs font-mono whitespace-nowrap overflow-hidden text-ellipsis block max-w-xs">
          {url}
        </span>
      )
    },
    {
      title: 'Response Type',
      dataIndex: 'responseContentType',
      key: 'responseContentType',
      width: 200,
      render: (contentType) => (
        <span className="text-xs font-mono whitespace-nowrap overflow-hidden text-ellipsis block">
          {contentType || '-'}
        </span>
      )
    },
    {
      title: 'Req Size',
      dataIndex: 'requestBodySize',
      key: 'requestBodySize',
      width: 80,
      render: (bytes) => (
        <span className="text-xs whitespace-nowrap">
          {formatBytes(bytes)}
        </span>
      )
    },
    {
      title: 'Resp Size',
      dataIndex: 'responseBodySize',
      key: 'responseBodySize',
      width: 80,
      render: (bytes) => (
        <span className="text-xs whitespace-nowrap">
          {formatBytes(bytes)}
        </span>
      )
    }
  ]

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-600">Error loading requests: {error.message}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="p-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold">Requests</h1>
            <p className="text-gray-600">View all proxied HTTP requests and responses</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              {allRequests.length > 0 && `Displaying ${allRequests.length} messages`}
            </div>
            <Button
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={handleRefresh}
              loading={isLoading}
              size="large"
            >
              Refresh Now
            </Button>
            <Switch
              checked={liveRefresh}
              onChange={setLiveRefresh}
              checkedChildren="Live"
              unCheckedChildren="Live"
            />
          </div>
        </div>
        <div className="flex items-center justify-between mb-4">
          <div />
          {lastRefreshed && (
            <div className="text-xs text-gray-500">
              Last refreshed at {lastRefreshed.toLocaleTimeString()} ({formatDate(lastRefreshed.toISOString()).ago})
            </div>
          )}
        </div>
      </div>

      <div className="px-6 pb-6">
        <div className="bg-white rounded-lg shadow">
          <Table
            columns={columns}
            dataSource={allRequests}
            loading={isLoading}
            rowKey="id"
            pagination={false}
            scroll={{ x: true }}
            size="small"
            className={styles.compactTable}
            onRow={(record) => ({
              onClick: () => {
                setSelectedRequest(record)
                setActiveTab('request')
                updateUrl(record.id, 'request')
              },
              style: { cursor: 'pointer' }
            })}
          />
          {hasMore && (
            <div className="p-4 text-center border-t">
              <Button
                onClick={handleLoadMore}
                loading={loadingMore || isLoading}
                size="large"
              >
                Load More
              </Button>
            </div>
          )}
        </div>
      </div>

      <RequestDetails
        selectedRequest={selectedRequest}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab)
          updateUrl(selectedRequest!.id, tab)
        }}
        onClose={() => {
          setSelectedRequest(null)
          updateUrl(null)
        }}
        showShare={true}
      />
    </div>
  )
}