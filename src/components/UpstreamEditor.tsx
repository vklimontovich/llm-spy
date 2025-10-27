'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter, useParams } from 'next/navigation'
import { Button, Select, Modal, notification } from 'antd'
import {
  Plus,
  Trash2,
  Save,
  X,
  Server,
  Link2,
  HelpCircle,
  Settings,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { validateUpstreamName } from '@/lib/model/validation'
import GettingStarted from './GettingStarted'
import { useWorkspaceTrpc } from '@/lib/trpc'
import type { Upstream, Header as SchemaHeader } from '@/schemas/upstreams'

// Client-side header type with override instead of priority for form state
type ClientHeader = Omit<SchemaHeader, 'priority'> & {
  override: boolean
}

// Client-side upstream type for form state
type UpstreamFormData = Omit<Upstream, 'headers' | 'otelUpstreams'> & {
  headers: ClientHeader[]
  otelUpstreams: Array<{
    id?: string
    url: string
    headers: ClientHeader[]
  }>
}

interface UpstreamEditorProps {
  id: string
}

// Header Row Component
const HeaderRow = ({
  header,
  onChange,
  onRemove,
  showOverride = true,
}: {
  header: ClientHeader
  onChange: (header: ClientHeader) => void
  onRemove: () => void
  showOverride?: boolean
}) => {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="flex items-center gap-3 group">
      <input
        type="text"
        value={header.name}
        onChange={e => onChange({ ...header, name: e.target.value })}
        placeholder="Header name"
        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <input
        type="text"
        value={header.value}
        onChange={e => onChange({ ...header, value: e.target.value })}
        placeholder="Header value"
        className="flex-[2] px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {showOverride && (
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={header.override}
              onChange={e =>
                onChange({ ...header, override: e.target.checked })
              }
              className="sr-only peer"
            />
            <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            <span className="text-sm text-gray-600 whitespace-nowrap">
              Override
            </span>
          </label>
          <div className="relative">
            <button
              type="button"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <HelpCircle className="w-4 h-4 text-gray-400" />
            </button>
            {showTooltip && (
              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-10">
                <div className="font-semibold mb-1">
                  Override Incoming Headers
                </div>
                <p>
                  When enabled, this header will replace any existing header
                  with the same name from the incoming request. When disabled,
                  the header is only added if not already present.
                </p>
                <div className="absolute bottom-0 right-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
              </div>
            )}
          </div>
        </div>
      )}
      <Button
        type="text"
        danger
        icon={<Trash2 className="w-4 h-4" />}
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </div>
  )
}

// Section Component
const Section = ({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon?: React.ElementType
  children: React.ReactNode
}) => (
  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        {Icon && <Icon className="w-5 h-5 text-gray-600" />}
        {title}
      </h2>
    </div>
    <div className="p-6">{children}</div>
  </div>
)

// Loading State Component
const LoadingState = () => (
  <div className="flex flex-col items-center justify-center h-64">
    <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
    <p className="text-gray-500">Loading upstream configuration...</p>
  </div>
)

// Error State Component
const ErrorState = ({ message }: { message: string }) => (
  <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
    <div>
      <h3 className="font-semibold text-red-900">Error Loading Upstream</h3>
      <p className="text-red-700 text-sm mt-1">{message}</p>
    </div>
  </div>
)

export default function UpstreamEditor({ id }: UpstreamEditorProps) {
  const router = useRouter()
  const params = useParams()
  const queryClient = useQueryClient()
  const isNew = id === 'new'

  const [formData, setFormData] = useState<UpstreamFormData>({
    name: '',
    url: 'https://api.anthropic.com',
    headers: [],
    inputFormat: 'anthropic',
    outputFormat: null,
    keepAuthHeaders: false,
    otelUpstreams: [],
  })

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [nameError, setNameError] = useState<string | undefined>()
  const trpc = useWorkspaceTrpc()

  const {
    data: upstream,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['upstream', id],
    queryFn: () => {
      if (isNew) return null
      return trpc.upstreams.getById.query({ id })
    },
    enabled: !isNew,
  })

  const createMutation = useMutation({
    mutationFn: (data: UpstreamFormData) => {
      // Convert override boolean to priority for API
      const apiData: Upstream = {
        ...data,
        headers: data.headers.map(h => ({
          name: h.name,
          value: h.value,
          priority: h.override ? ('high' as const) : ('low' as const),
        })),
        otelUpstreams: data.otelUpstreams.map(o => ({
          ...o,
          headers: o.headers.map(h => ({
            name: h.name,
            value: h.value,
            priority: h.override ? ('high' as const) : ('low' as const),
          })),
        })),
      }
      return trpc.upstreams.create.mutate(apiData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upstreams'] })
      router.push(`/${params.workspace}/upstreams`)
    },
    onError: (error: Error) => {
      console.error('Failed to create upstream:', error)
      notification.error({
        message: 'Failed to create upstream',
        description:
          error.message || 'An error occurred while creating upstream',
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: UpstreamFormData) => {
      // Convert override boolean to priority for API
      const apiData: Upstream = {
        ...data,
        headers: data.headers.map(h => ({
          name: h.name,
          value: h.value,
          priority: h.override ? ('high' as const) : ('low' as const),
        })),
        otelUpstreams: data.otelUpstreams.map(o => ({
          ...o,
          headers: o.headers.map(h => ({
            name: h.name,
            value: h.value,
            priority: h.override ? ('high' as const) : ('low' as const),
          })),
        })),
      }
      return trpc.upstreams.update.mutate({ id, data: apiData })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upstreams'] })
      router.push(`/${params.workspace}/upstreams`)
    },
    onError: (error: Error) => {
      console.error('Failed to update upstream:', error)
      notification.error({
        message: 'Failed to update upstream',
        description:
          error.message || 'An error occurred while updating upstream',
      })
    },
  })

  const saveMutation = {
    mutate: (data: UpstreamFormData) => {
      if (isNew) {
        createMutation.mutate(data)
      } else {
        updateMutation.mutate(data)
      }
    },
    isPending: createMutation.isPending || updateMutation.isPending,
  }

  useEffect(() => {
    if (upstream) {
      // Cast to any to avoid TypeScript recursion depth errors with tRPC types
      const upstreamData = upstream as any

      setFormData({
        name: upstreamData.name || '',
        url: upstreamData.url || '',
        inputFormat: (upstreamData.inputFormat || 'anthropic') as
          | 'auto'
          | 'anthropic'
          | 'openai'
          | 'otel',
        outputFormat: (upstreamData.outputFormat || null) as
          | 'anthropic'
          | 'openai'
          | null,
        keepAuthHeaders: upstreamData.keepAuthHeaders ?? false,
        headers: Array.isArray(upstreamData.headers)
          ? upstreamData.headers.map((h: any) => ({
              name: h.name,
              value: h.value,
              override: h.priority === 'high',
            }))
          : Object.entries(upstreamData.headers || {}).map(([name, value]) => ({
              name,
              value: String(value),
              override: false,
            })),
        otelUpstreams:
          upstream.otelUpstreams?.map((collector: any) => ({
            id: collector.id,
            url: collector.url,
            headers: Array.isArray(collector.headers)
              ? collector.headers.map((h: any) => ({
                  name: h.name,
                  value: h.value,
                  override: h.priority === 'high',
                }))
              : Object.entries(collector.headers || {}).map(
                  ([name, value]) => ({
                    name,
                    value: String(value),
                    override: false,
                  })
                ),
          })) || [],
      })
    }
  }, [upstream])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate upstream name before submitting
    const validation = validateUpstreamName(formData.name)
    if (!validation.valid) {
      setNameError(validation.error)
      return
    }

    saveMutation.mutate(formData)
  }

  const addHeader = () => {
    setFormData({
      ...formData,
      headers: [...formData.headers, { name: '', value: '', override: false }],
    })
  }

  const updateHeader = (index: number, header: ClientHeader) => {
    const newHeaders = [...formData.headers]
    newHeaders[index] = header
    setFormData({ ...formData, headers: newHeaders })
  }

  const removeHeader = (index: number) => {
    setFormData({
      ...formData,
      headers: formData.headers.filter((_, i) => i !== index),
    })
  }

  // OTEL collector management functions - currently unused, reserved for future features
  // const addOtelCollector = () => {
  //   setFormData({
  //     ...formData,
  //     otelUpstreams: [...formData.otelUpstreams, { url: '', headers: [] }],
  //   })
  // }

  // const updateOtelCollector = (index: number, collector: OtelCollector) => {
  //   const newCollectors = [...formData.otelUpstreams]
  //   newCollectors[index] = collector
  //   setFormData({ ...formData, otelUpstreams: newCollectors })
  // }

  // const removeOtelCollector = (index: number) => {
  //   setFormData({
  //     ...formData,
  //     otelUpstreams: formData.otelUpstreams.filter((_, i) => i !== index),
  //   })
  // }

  // Keep URL in sync with selected provider when URL hasn't been customized
  useEffect(() => {
    const providerForUrl = formData.outputFormat || formData.inputFormat
    const defaultUrl =
      providerForUrl === 'anthropic'
        ? 'https://api.anthropic.com'
        : providerForUrl === 'openai'
          ? 'https://api.openai.com'
          : 'https://api.example.com'
    const knownDefaults = [
      'https://api.anthropic.com',
      'https://api.openai.com',
      'https://api.example.com',
      '',
    ]
    if (
      formData.url &&
      knownDefaults.includes(formData.url) &&
      formData.url !== defaultUrl
    ) {
      setFormData(prev => ({ ...prev, url: defaultUrl }))
    }
  }, [formData.inputFormat, formData.outputFormat, formData.url])

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState message={(error as Error).message} />

  const providerForUrl = formData.outputFormat || formData.inputFormat

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col gap-6">
        {/* Connection Instructions */}
        {!isNew && formData.name && (
          <div className="mb-6 flex justify-end">
            <Button
              type="primary"
              size="large"
              onClick={() => setIsModalOpen(true)}
            >
              How to Connect
            </Button>
          </div>
        )}

        {/* General Section */}
        <Section title="General" icon={Settings}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => {
                  const newName = e.target.value
                  setFormData({ ...formData, name: newName })

                  // Validate on change
                  const validation = validateUpstreamName(newName)
                  setNameError(validation.valid ? undefined : validation.error)
                }}
                placeholder="production_upstream"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                  nameError
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-gray-200 focus:ring-blue-500'
                }`}
              />
              {nameError && (
                <p className="mt-1 text-sm text-red-600">{nameError}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Must start with a letter or underscore, and can only contain
                letters, numbers, and underscores
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Input Format
              </label>
              <Select
                value={formData.inputFormat}
                onChange={value => {
                  setFormData(prev => ({
                    ...prev,
                    inputFormat: value,
                  }))
                }}
                options={[
                  { value: 'anthropic', label: 'Anthropic' },
                  { value: 'openai-chat', label: 'OpenAI Chat Completion' },
                  { value: 'openai-responses', label: 'OpenAI Responses' },
                ]}
                className="w-full"
                size="large"
              />
            </div>
          </div>
        </Section>

        {/* LLM Backend Section */}
        <Section title="LLM Backend" icon={Server}>
          <div className="flex flex-col gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URL
              </label>
              <input
                type="url"
                value={formData.url}
                onChange={e =>
                  setFormData({ ...formData, url: e.target.value })
                }
                placeholder={
                  providerForUrl === 'anthropic'
                    ? 'https://api.anthropic.com'
                    : providerForUrl === 'openai'
                      ? 'https://api.openai.com'
                      : 'https://api.example.com'
                }
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Headers subsection */}
            <div className="flex flex-col gap-3 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">Headers</h3>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Headers will be added to outgoing requests to the LLM backend.
                You can use this to add or override authentication headers (like
                API keys), set custom headers, or modify request metadata.
              </p>

              {formData.headers.length > 0 ? (
                formData.headers.map((header, index) => (
                  <HeaderRow
                    key={index}
                    header={header}
                    onChange={h => updateHeader(index, h)}
                    onRemove={() => removeHeader(index)}
                  />
                ))
              ) : (
                <p className="text-gray-500 text-sm py-4 text-center bg-gray-50 rounded-lg">
                  No headers configured
                </p>
              )}

              <Button
                type="dashed"
                onClick={addHeader}
                icon={<Plus className="w-4 h-4" />}
                className="mt-2 w-full"
              >
                Add Header
              </Button>
            </div>
          </div>
        </Section>

        {/* Security Section */}
        <Section title="Security & Privacy" icon={Settings}>
          <div className="flex flex-col gap-4">
            <div className="flex-1">
              <label className="inline-flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.keepAuthHeaders}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      keepAuthHeaders: e.target.checked,
                    })
                  }
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    Keep Authentication Headers
                  </span>
                </div>
              </label>
              <div className="mt-2 text-sm text-gray-600">
                <p className="mb-2">
                  By default, authentication and security-related headers are
                  masked before being stored in the database to protect
                  sensitive credentials.
                </p>
                <p className="mb-2">
                  When <strong>disabled</strong> (recommended), headers like{' '}
                  <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">
                    Authorization
                  </code>
                  ,{' '}
                  <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">
                    X-API-Key
                  </code>
                  , and{' '}
                  <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">
                    Cookie
                  </code>{' '}
                  will be masked as{' '}
                  <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">
                    sk-a***MASKED***1234
                  </code>{' '}
                  in stored request/response logs.
                </p>
                <p>
                  Enable this option only if you need to store the full
                  authentication headers for debugging purposes.
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* OpenTelemetry Collectors Section */}
        <Section title="OpenTelemetry Collectors" icon={Link2}>
          <div className="relative min-h-[240px]">
            {/* Overlay message */}
            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-lg z-10 flex items-center justify-center p-4">
              <div className="text-center px-4 py-8 max-w-2xl">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-blue-600" />
                </div>
                <p className="text-lg font-semibold text-gray-900 mb-3">
                  Coming Soon
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  LLM request and response payloads will be automatically
                  transformed into OpenTelemetry spans with AI semantic
                  conventions and forwarded to configured collectors for
                  observability and tracing.
                </p>
              </div>
            </div>

            {/* Disabled form fields underneath */}
            <div className="flex flex-col gap-4 opacity-20 pointer-events-none">
              <p className="text-gray-500 text-sm py-4 text-center">
                No OpenTelemetry collectors configured.
              </p>
              <Button
                type="dashed"
                disabled
                icon={<Plus className="w-4 h-4" />}
                className="w-full"
              >
                Add OpenTelemetry Collector
              </Button>
            </div>
          </div>
        </Section>

        {/* Action Buttons */}
        <div className="flex items-center justify-between py-4">
          <Button
            onClick={() => router.push(`/${params.workspace}/upstreams`)}
            icon={<X className="w-4 h-4" />}
            size="large"
          >
            Cancel
          </Button>

          <Button
            type="primary"
            htmlType="submit"
            loading={saveMutation.isPending}
            icon={!saveMutation.isPending && <Save className="w-4 h-4" />}
            size="large"
          >
            {isNew ? 'Create Upstream' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* How to Connect Modal */}
      <Modal
        title="How to Connect"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={900}
        centered
      >
        <GettingStarted fixedUpstreamId={id} isModal={true} />
      </Modal>
    </form>
  )
}
