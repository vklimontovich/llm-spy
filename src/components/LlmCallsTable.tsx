'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Table, Button, Switch, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useState } from 'react'
import { RefreshCw, User, Bot, Database } from 'lucide-react'
import styles from '@/app/(protected)/[workspace]/requests/page.module.css'
import RequestDetails from '@/components/RequestDetails'
import GettingStarted from '@/components/GettingStarted'
import { useRouter, useSearchParams } from 'next/navigation'
import { useWorkspaceApi } from '@/lib/api'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { LlmCall, Filter } from '@/types/requests'

const PAGE_SIZE = 100

interface FilterDisplayProps {
  filters: Filter[]
  onRemove: (index: number) => void
  onClearAll: () => void
}

function FilterDisplay({ filters, onRemove, onClearAll }: FilterDisplayProps) {
  if (filters.length === 0) return null

  return (
    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-700">Filters</span>
          <span className="text-xs text-gray-500">({filters.length})</span>
        </div>
        <button
          onClick={onClearAll}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          Clear all
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {filters.map((filter, index) => (
          <div
            key={index}
            className="inline-flex items-center gap-2 px-2 py-1 bg-white border border-gray-300 rounded text-xs"
          >
            <span className="text-gray-600">
              {filter.field === 'conversationId'
                ? 'Conversation'
                : filter.field}
            </span>
            <span className="text-gray-400">=</span>
            <span className="font-mono text-gray-900">
              {filter.value || filter.values?.join(', ')}
            </span>
            <button
              onClick={() => onRemove(index)}
              className="ml-1 text-gray-400 hover:text-gray-600"
              title="Remove filter"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LlmCallsTable() {
  const [selectedRequest, setSelectedRequest] = useState<LlmCall | null>(null)
  const [liveRefresh, setLiveRefresh] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [allRequests, setAllRequests] = useState<LlmCall[]>([])
  const [filters, setFilters] = useState<Filter[]>([])

  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const api = useWorkspaceApi()
  const { workspace } = useWorkspace()

  // Load filters from URL on mount
  useEffect(() => {
    const filterParam = searchParams.get('filter')
    if (filterParam) {
      try {
        const parsed = JSON.parse(filterParam)
        if (Array.isArray(parsed)) {
          setFilters(parsed)
        }
      } catch {
        // Ignore invalid filter params
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['requests', offset, filters],
    queryFn: async () => {
      const params: any = {
        limit: PAGE_SIZE,
        offset: offset,
      }

      if (filters.length > 0) {
        params.filter = JSON.stringify(filters)
      }

      const response = await api.get('/requests', { params })
      const result = response.data
      setHasMore(result.items && result.items.length === PAGE_SIZE)
      return result
    },
  })

  // Let the error boundary above catch errors
  if (error) {
    throw error
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

  const updateFiltersInUrl = (newFilters: Filter[]) => {
    const params = new URLSearchParams(searchParams.toString())
    if (newFilters.length > 0) {
      params.set('filter', JSON.stringify(newFilters))
    } else {
      params.delete('filter')
    }
    const newUrl = params.toString()
      ? `/${workspace.slug}/requests?${params.toString()}`
      : `/${workspace.slug}/requests`
    router.push(newUrl, { scroll: false })
  }

  const addFilter = (filter: Filter) => {
    // Check if filter already exists
    const exists = filters.some(
      f => f.field === filter.field && f.value === filter.value
    )
    if (!exists) {
      const newFilters = [...filters, filter]
      setFilters(newFilters)
      setOffset(0)
      setAllRequests([])
      setHasMore(true)
      updateFiltersInUrl(newFilters)
    }
  }

  const removeFilter = (index: number) => {
    const newFilters = filters.filter((_, i) => i !== index)
    setFilters(newFilters)
    setOffset(0)
    setAllRequests([])
    setHasMore(true)
    updateFiltersInUrl(newFilters)
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

  const columns: ColumnsType<LlmCall> = [
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
              const isPlainLeft =
                e.button === 0 &&
                !e.metaKey &&
                !e.ctrlKey &&
                !e.shiftKey &&
                !e.altKey
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
      render: model =>
        !model ? (
          <span className="text-xs text-gray-400">-</span>
        ) : (
          <span
            className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 whitespace-nowrap"
            title={model}
          >
            {model}
          </span>
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
              isSuccess
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {isSuccess ? 'OK' : 'ERR'}
          </span>
        )
      },
    },
    {
      title: <span className="whitespace-nowrap">Conversation</span>,
      key: 'conversationId',
      width: 70,
      render: (_, record) => {
        if (!record.conversationId)
          return <span className="text-xs text-gray-400">-</span>
        const conversationId = record.conversationId
        return (
          <span
            className="text-xs font-mono text-blue-600 cursor-pointer hover:underline"
            title={conversationId}
            onClick={e => {
              e.stopPropagation()
              addFilter({
                field: 'conversationId',
                expr: '=',
                value: conversationId,
              })
            }}
          >
            {conversationId}
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

        // Handle new object format: { input, output }
        let inputLine = '-'
        let outputLine: string | null = null

        if (
          preview &&
          typeof preview === 'object' &&
          'input' in preview &&
          'output' in preview
        ) {
          inputLine = preview.input || '-'
          outputLine = preview.output || null
        } else if (typeof preview === 'string') {
          // Backward compatibility: old string format
          const lines = preview.split('\n')
          inputLine = lines[0] || '-'
          outputLine = lines[1] || null
        }

        return (
          <a
            href={href}
            className="block text-xs"
            onClick={e => {
              if (e.defaultPrevented) return
              const isPlainLeft =
                e.button === 0 &&
                !e.metaKey &&
                !e.ctrlKey &&
                !e.shiftKey &&
                !e.altKey
              if (isPlainLeft) {
                e.preventDefault()
                setSelectedRequest(record)
                updateUrl(record.id, 'chat')
              }
            }}
          >
            <div className="flex items-start gap-1 truncate text-gray-500">
              <User className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-40" />
              <span className="truncate">{inputLine}</span>
            </div>
            {outputLine && (
              <div className="flex items-start gap-1 truncate text-gray-500">
                <Bot className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-40" />
                <span className="truncate">{outputLine}</span>
              </div>
            )}
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
          <span
            className="text-xs font-mono"
            title="Prompt/input token count for this call (base; cached read+create)"
          >
            {formatNumber(base)}
            <br />
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
        <span
          className="text-xs font-mono"
          title="Completion/output token count for this call"
        >
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
        <span className="text-xs font-mono">{formatPrice(record.price)}</span>
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

  // row navigation handled inline via links in cells

  return (
    <div className="min-h-screen">
      <div className="p-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold">LLM Calls</h1>
            <p className="text-gray-600">View all captured LLM Calls</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              {allRequests.length > 0 &&
                `Displaying ${allRequests.length} messages`}
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
        <FilterDisplay
          filters={filters}
          onRemove={removeFilter}
          onClearAll={() => {
            setFilters([])
            setOffset(0)
            setAllRequests([])
            setHasMore(true)
            updateFiltersInUrl([])
          }}
        />
        <div className="flex items-center justify-between mb-4">
          <div />
          {lastRefreshed && (
            <div className="text-xs text-gray-500">
              Last refreshed at {lastRefreshed.toLocaleTimeString()} (
              {formatDate(lastRefreshed.toISOString()).ago})
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
            locale={{
              emptyText:
                !isLoading &&
                allRequests.length === 0 &&
                filters.length === 0 ? (
                  <div className="text-left">
                    <div className="text-center py-8">
                      <Database className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <div className="text-lg font-medium text-gray-600">
                        No data to display
                      </div>
                    </div>
                    <GettingStarted header="Get Started - Make Your First API Call" />
                  </div>
                ) : (
                  'No data'
                ),
            }}
            // No row-level click; links inside cells handle navigation
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
        onClose={() => {
          setSelectedRequest(null)
          updateUrl(null)
        }}
        showShare={true}
      />
    </div>
  )
}
