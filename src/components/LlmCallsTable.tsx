'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Table, Button, Switch, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import styles from '@/app/(protected)/[workspace]/requests/page.module.css'
import RequestDetails from '@/components/RequestDetails'
import { extractSessionId } from '@/lib/session-utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { useWorkspaceApi } from '@/lib/api'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { RequestResponse } from '@/types/requests'

const PAGE_SIZE = 100

export default function LlmCallsTable() {
  const [selectedRequest, setSelectedRequest] =
    useState<RequestResponse | null>(null)
  const [liveRefresh, setLiveRefresh] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [allRequests, setAllRequests] = useState<RequestResponse[]>([])

  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const api = useWorkspaceApi()
  const { workspace } = useWorkspace()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['requests', offset],
    queryFn: async () => {
      const response = await api.get('/requests', {
        params: {
          limit: PAGE_SIZE,
          offset: offset,
        },
      })
      const result = response.data
      setHasMore(result.items && result.items.length === PAGE_SIZE)
      return result
    },
  })

  // Let the error boundary above catch errors
  if (error) {
    throw error;
  }

  // Update last refreshed when data changes
  useEffect(() => {
    if (data) {
      setLastRefreshed(new Date())
    }
  }, [data])

  // Merge pages
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
    if (requestId && allRequests.length > 0) {
      const request = allRequests.find(req => req.id === requestId)
      if (request) {
        setSelectedRequest(request)
      }
    }
  }, [searchParams, allRequests])

  // Update URL when request/tab changes
  const updateUrl = (requestId: string | null, tabKey?: string) => {
    const params = new URLSearchParams()
    if (requestId) {
      params.set('id', requestId)
      if (tabKey) params.set('tab', tabKey)
    }
    const newUrl = params.toString()
      ? `/${workspace.slug}/requests?${params.toString()}`
      : `/${workspace.slug}/requests`
    router.push(newUrl, { scroll: false })
  }

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
    setOffset(prev => prev + PAGE_SIZE)
    setLoadingMore(false)
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i]
  }

  const formatNumber = (num: number | null | undefined) => {
    if (num == null) return '-'
    return num.toLocaleString('en-US')
  }

  const formatPrice = (price: number | null | undefined) => {
    if (price == null) return '-'
    return `$${price.toFixed(2)}`
  }

  const formatDuration = (ms: number | null | undefined) => {
    if (ms == null) return '-'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const getOutputTokens = (usage: any | null | undefined) => {
    if (!usage) return 0
    return Number(usage.output_tokens || 0)
  }

  const getCachedTokens = (usage: any | null | undefined) => {
    if (!usage) return 0
    const read = Number(usage.cache_read_input_tokens || 0)
    const flatCreate = Number(usage.cache_creation_input_tokens || 0)
    const nestedCreate =
      Number(usage.cache_creation?.ephemeral_1h_input_tokens || 0) +
      Number(usage.cache_creation?.ephemeral_5m_input_tokens || 0)
    const create = flatCreate || nestedCreate
    return read + create
  }

  const computePriceUsd = (
    pricing: any,
    usage: any | null | undefined,
    modelId?: string | null | undefined
  ) => {
    if (!pricing || !usage) return null
    const isObj = (v: any) => v && typeof v === 'object' && !Array.isArray(v)
    let cost: any = null
    if (isObj(pricing)) {
      const keys = Object.keys(pricing)
      const looksKeyed = keys.some(k => isObj((pricing as any)[k]))
      if (looksKeyed) {
        const rec = pricing as Record<string, any>
        const key = modelId && rec[modelId] ? modelId : keys[0]
        cost = rec[key]
      } else {
        cost = pricing
      }
    }
    if (!cost) return null
    const inTokens = Number(usage.input_tokens || 0)
    const rdTokens = Number(usage.cache_read_input_tokens || 0)
    const wrTokensFlat = Number(usage.cache_creation_input_tokens || 0)
    const wrTokensNested =
      Number(usage.cache_creation?.ephemeral_1h_input_tokens || 0) +
      Number(usage.cache_creation?.ephemeral_5m_input_tokens || 0)
    const wrTokens = wrTokensFlat || wrTokensNested
    const outTokens = Number(usage.output_tokens || 0)
    const total =
      (inTokens / 1_000_000) * (Number(cost.input) || 0) +
      (rdTokens / 1_000_000) * (Number(cost.cache_read) || Number(cost.input) || 0) +
      (wrTokens / 1_000_000) * (Number(cost.cache_write) || Number(cost.input) || 0) +
      (outTokens / 1_000_000) * (Number(cost.output) || 0)
    return total
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
    if (days > 0) timeAgo = `${days}d ago`
    else if (hours > 0) timeAgo = `${hours}h ago`
    else if (minutes > 0) timeAgo = `${minutes}m ago`
    else timeAgo = `${seconds}s ago`
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const hoursFormatted = String(date.getUTCHours()).padStart(2, '0')
    const minutesFormatted = String(date.getUTCMinutes()).padStart(2, '0')
    const secondsFormatted = String(date.getUTCSeconds()).padStart(2, '0')
    return {
      full: `${year}-${month}-${day} ${hoursFormatted}:${minutesFormatted}:${secondsFormatted} UTC`,
      ago: timeAgo,
    }
  }

  const columns: ColumnsType<RequestResponse> = [
    {
      title: 'Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      fixed: 'left',
      render: (date, record) => {
        const formatted = formatDate(date)
        const href = (() => {
          const params = new URLSearchParams(searchParams.toString())
          params.set('id', record.id)
          params.set('tab', 'chat')
          return `/${workspace.slug}/requests?${params.toString()}`
        })()
        return (
          <a
            href={href}
            className="block text-xs font-mono whitespace-nowrap"
            onClick={e => {
              if (e.defaultPrevented) return
              // Intercept only plain left-clicks; let modified/middle/right clicks pass
              const isPlainLeft = e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
              if (isPlainLeft) {
                e.preventDefault()
                setSelectedRequest(record)
                updateUrl(record.id, 'chat')
              }
            }}
          >
            <div>{formatted.full}</div>
            <div className="text-gray-500">({formatted.ago})</div>
          </a>
        )
      },
    },
    {
      title: <span className="whitespace-nowrap">Model</span>,
      dataIndex: 'responseModel',
      key: 'responseModel',
      width: 120,
      render: model => (
        !model ? (
          <span className="text-xs text-gray-400">-</span>
        ) : (
          <span
            className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 whitespace-nowrap"
            title={model}
          >
            {model}
          </span>
        )
      ),
    },
    {
      title: <span className="whitespace-nowrap">Status</span>,
      dataIndex: 'status',
      key: 'status',
      width: 70,
      render: status => {
        const isSuccess = status >= 200 && status < 300
        return (
          <span
            className={`px-1.5 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
              isSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {isSuccess ? 'OK' : 'ERR'}
          </span>
        )
      },
    },
    {
      title: <span className="whitespace-nowrap">Session</span>,
      key: 'sessionId',
      width: 70,
      render: (_, record) => {
        const sessionId = extractSessionId(record.requestHeaders)
        if (!sessionId) return <span className="text-xs text-gray-400">-</span>
        return (
          <span className="text-xs font-mono text-blue-600" title={sessionId}>
            {sessionId}
          </span>
        )
      },
    },
    {
      title: <span className="whitespace-nowrap">Preview</span>,
      dataIndex: 'preview',
      key: 'preview',
      width: 250,
      ellipsis: true,
      render: (preview, record) => {
        const href = (() => {
          const params = new URLSearchParams(searchParams.toString())
          params.set('id', record.id)
          params.set('tab', 'chat')
          return `/${workspace.slug}/requests?${params.toString()}`
        })()
        const lines = preview?.split('\n') || ['-']
        return (
          <a
            href={href}
            className="block text-xs text-gray-600"
            onClick={e => {
              if (e.defaultPrevented) return
              const isPlainLeft = e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
              if (isPlainLeft) {
                e.preventDefault()
                setSelectedRequest(record)
                updateUrl(record.id, 'chat')
              }
            }}
          >
            {lines[0] && <div className="truncate">{lines[0]}</div>}
            {lines[1] && <div className="truncate text-gray-500">{lines[1]}</div>}
          </a>
        )
      },
    },
    {
      title: (
        <Tooltip title="Input tokens: base; cached (read+create) shown in parentheses if present">
          <span className="whitespace-nowrap">Input</span>
        </Tooltip>
      ),
      key: 'inputTokens',
      width: 70,
      align: 'right',
      fixed: 'right',
      render: (_, record) => {
        const base = Number(record.usage?.input_tokens || 0)
        const cached = getCachedTokens(record.usage)
        return (
          <span className="text-xs font-mono" title="Prompt/input token count for this call (base; cached read+create)">
            {formatNumber(base)}<br />
            <span className="whitespace-nowrap text-xs text-gray-500">
              {cached > 0 ? ` (+${formatNumber(cached)} cached)` : ''}
            </span>
          </span>
        )
      },
    },
    {
      title: (
        <Tooltip title="Output tokens generated by the model (completion)">
          <span className="whitespace-nowrap">Output</span>
        </Tooltip>
      ),
      key: 'outputTokens',
      width: 70,
      align: 'right',
      fixed: 'right',
      render: (_, record) => (
        <span className="text-xs font-mono" title="Completion/output token count for this call">
          {formatNumber(getOutputTokens(record.usage))}
        </span>
      ),
    },
    {
      title: <span className="whitespace-nowrap">Price</span>,
      key: 'price',
      width: 80,
      align: 'right',
      fixed: 'right',
      render: (_, record) => (
        <span className="text-xs font-mono">
          {formatPrice(
            computePriceUsd(record.pricing, record.usage, record.responseModel)
          )}
        </span>
      ),
    },
    {
      title: <span className="whitespace-nowrap">Duration</span>,
      dataIndex: 'durationMs',
      key: 'durationMs',
      width: 70,
      align: 'right',
      fixed: 'right',
      render: duration => (
        <span className="text-xs font-mono">{formatDuration(duration)}</span>
      ),
    },
    {
      title: <span className="whitespace-nowrap">Req</span>,
      dataIndex: 'requestBodySize',
      key: 'requestBodySize',
      width: 60,
      align: 'right',
      fixed: 'right',
      render: bytes => (
        <span className="text-xs font-mono">{formatBytes(bytes)}</span>
      ),
    },
    {
      title: <span className="whitespace-nowrap">Res</span>,
      dataIndex: 'responseBodySize',
      key: 'responseBodySize',
      width: 60,
      align: 'right',
      fixed: 'right',
      render: bytes => (
        <span className="text-xs font-mono">{formatBytes(bytes)}</span>
      ),
    },
  ]

  const rowHref = (id: string) => `/${workspace.slug}/requests?id=${id}`

  return (
    <div className="min-h-screen">
      <div className="p-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold">LLM Calls</h1>
            <p className="text-gray-600">View all captured LLM CallsNow</p>
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
              Last refreshed at {lastRefreshed.toLocaleTimeString()} ({
                formatDate(lastRefreshed.toISOString()).ago
              })
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
            // No row-level click; links inside cells handle navigation
          />
          {hasMore && (
            <div className="p-4 text-center border-t">
              <Button onClick={handleLoadMore} loading={loadingMore || isLoading} size="large">
                Load More
              </Button>
            </div>
          )}
        </div>
      </div>

      <RequestDetails
        selectedRequest={selectedRequest}
        onClose={() => {
          setSelectedRequest(null)
          updateUrl(null)
        }}
        showShare={true}
      />
    </div>
  )
}
