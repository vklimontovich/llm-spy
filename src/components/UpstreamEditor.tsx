'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Button, Select } from 'antd'
import {
  Plus,
  Trash2,
  Save,
  X,
  Server,
  Link2,
  FileJson,
  HelpCircle,
  Settings,
  Loader2,
  AlertCircle,
} from 'lucide-react'

interface Header {
  name: string
  value: string
  override: boolean
}

interface OtelCollector {
  id?: string
  url: string
  headers: Header[]
}

interface UpstreamData {
  name: string
  url: string
  headers: Header[]
  inputFormat: string
  outputFormat: string | null
  otelUpstreams: OtelCollector[]
}

interface UpstreamEditorProps {
  id: string
}

// Header Row Component
const HeaderRow = ({
  header,
  onChange,
  onRemove,
  showOverride = true
}: {
  header: Header
  onChange: (header: Header) => void
  onRemove: () => void
  showOverride?: boolean
}) => {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="flex items-center gap-3 group">
      <input
        type="text"
        value={header.name}
        onChange={(e) => onChange({ ...header, name: e.target.value })}
        placeholder="Header name"
        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <input
        type="text"
        value={header.value}
        onChange={(e) => onChange({ ...header, value: e.target.value })}
        placeholder="Header value"
        className="flex-[2] px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {showOverride && (
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={header.override}
              onChange={(e) => onChange({ ...header, override: e.target.checked })}
              className="sr-only peer"
            />
            <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            <span className="text-sm text-gray-600 whitespace-nowrap">Override</span>
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
                <div className="font-semibold mb-1">Override Incoming Headers</div>
                <p>When enabled, this header will replace any existing header with the same name from the incoming request. When disabled, the header is only added if not already present.</p>
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
  children
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
    <div className="p-6">
      {children}
    </div>
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
  const queryClient = useQueryClient()
  const isNew = id === 'new'

  const [formData, setFormData] = useState<UpstreamData>({
    name: '',
    url: '',
    headers: [],
    inputFormat: 'auto',
    outputFormat: null,
    otelUpstreams: []
  })

  const { data: upstream, isLoading, error } = useQuery({
    queryKey: ['upstream', id],
    queryFn: async () => {
      if (isNew) return null
      const response = await fetch(`/api/upstreams/${id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch upstream')
      }
      return response.json()
    },
    enabled: !isNew
  })

  const saveMutation = useMutation({
    mutationFn: async (data: UpstreamData) => {
      const url = isNew ? '/api/upstreams' : `/api/upstreams/${id}`
      const method = isNew ? 'POST' : 'PUT'

      // Convert override boolean to priority for API
      const apiData = {
        ...data,
        headers: data.headers.map(h => ({
          name: h.name,
          value: h.value,
          priority: h.override ? 'high' as const : 'low' as const
        })),
        otelUpstreams: data.otelUpstreams.map(o => ({
          ...o,
          headers: o.headers.map(h => ({
            name: h.name,
            value: h.value,
            priority: h.override ? 'high' as const : 'low' as const
          }))
        }))
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData)
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(error || 'Failed to save upstream')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upstreams'] })
      router.push('/upstreams')
    }
  })

  useEffect(() => {
    if (upstream) {
      // Map old format values to new provider values
      const mapInputFormat = (format: string) => {
        if (format === 'otel') return 'opentelemetry'
        return format || 'auto'
      }

      setFormData({
        name: upstream.name || '',
        url: upstream.url || '',
        inputFormat: mapInputFormat(upstream.inputFormat),
        outputFormat: upstream.outputFormat || null,
        headers: Array.isArray(upstream.headers)
          ? upstream.headers.map((h: any) => ({
              name: h.name,
              value: h.value,
              override: h.priority === 'high'
            }))
          : Object.entries(upstream.headers || {}).map(([name, value]) => ({
              name,
              value: String(value),
              override: false
            })),
        otelUpstreams: upstream.otelUpstreams?.map((collector: any) => ({
          id: collector.id,
          url: collector.url,
          headers: Array.isArray(collector.headers)
            ? collector.headers.map((h: any) => ({
                name: h.name,
                value: h.value,
                override: h.priority === 'high'
              }))
            : Object.entries(collector.headers || {}).map(([name, value]) => ({
                name,
                value: String(value),
                override: false
              }))
        })) || []
      })
    }
  }, [upstream])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate(formData)
  }

  const addHeader = () => {
    setFormData({
      ...formData,
      headers: [...formData.headers, { name: '', value: '', override: false }]
    })
  }

  const updateHeader = (index: number, header: Header) => {
    const newHeaders = [...formData.headers]
    newHeaders[index] = header
    setFormData({ ...formData, headers: newHeaders })
  }

  const removeHeader = (index: number) => {
    setFormData({
      ...formData,
      headers: formData.headers.filter((_, i) => i !== index)
    })
  }

  const addOtelCollector = () => {
    setFormData({
      ...formData,
      otelUpstreams: [...formData.otelUpstreams, { url: '', headers: [] }]
    })
  }

  const updateOtelCollector = (index: number, collector: OtelCollector) => {
    const newCollectors = [...formData.otelUpstreams]
    newCollectors[index] = collector
    setFormData({ ...formData, otelUpstreams: newCollectors })
  }

  const removeOtelCollector = (index: number) => {
    setFormData({
      ...formData,
      otelUpstreams: formData.otelUpstreams.filter((_, i) => i !== index)
    })
  }


  if (isLoading) return <LoadingState />
  if (error) return <ErrorState message={(error as Error).message} />

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col gap-6">
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
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Production Upstream"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Input Format
              </label>
              <Select
                value={formData.inputFormat}
                onChange={(value) => {
                  setFormData({
                    ...formData,
                    inputFormat: value,
                    // Auto-suggest URL if it's empty
                    url: formData.url
                  })
                }}
                options={[
                  { value: 'auto', label: 'Auto-detect' },
                  { value: 'otel', label: 'Open Telemetry' },
                  { value: 'anthropic', label: 'Anthropic' },
                  { value: 'openai', label: 'OpenAI' },
                ]}
                className="w-full"
                size="large"
              />
            </div>
          </div>
        </Section>

        {/* LLM Backend Section */}
        <Section title="LLM Backend" icon={Server}>
          {formData.inputFormat === 'otel' ? (
            <div className="relative">
              {/* Overlay message */}
              <div className="absolute inset-0 bg-white/90 backdrop-blur-sm rounded-lg z-10 flex items-center justify-center">
                <div className="text-center px-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <AlertCircle className="w-6 h-6 text-orange-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    Not available for OpenTelemetry
                  </p>
                  <p className="text-xs text-gray-600 max-w-sm">
                    OpenTelemetry data is processed asynchronously and cannot be forwarded to LLM backends
                  </p>
                </div>
              </div>
              
              {/* Disabled form fields underneath */}
              <div className="flex flex-col gap-4 opacity-30 pointer-events-none">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    URL
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    disabled
                    placeholder="https://api.example.com"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Backend Type
                  </label>
                  <Select
                    value={formData.outputFormat || ''}
                    disabled
                    options={[
                      { value: '', label: 'Same as input' },
                    ]}
                    className="w-full"
                    size="large"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Choose a different backend type to convert between formats
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder={
                    formData.inputFormat === 'anthropic' ? "https://api.anthropic.com" :
                    formData.inputFormat === 'openai' ? "https://api.openai.com" :
                    "https://api.example.com"
                  }
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Backend Type
                </label>
                <Select
                  value={formData.outputFormat || ''}
                  onChange={(value) => setFormData({ ...formData, outputFormat: value || null })}
                  options={[
                    { value: '', label: 'Same as input' },
                    { value: 'anthropic', label: 'Anthropic' },
                    { value: 'openai', label: 'OpenAI' },
                  ]}
                  className="w-full"
                  size="large"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Choose a different backend type to convert between formats
                </p>
              </div>
            </div>
          )}
        </Section>

        {/* Headers Section */}
        <Section title="Headers" icon={FileJson}>
          <div className="flex flex-col gap-3">
            {formData.headers.length > 0 ? (
              formData.headers.map((header, index) => (
                <HeaderRow
                  key={index}
                  header={header}
                  onChange={(h) => updateHeader(index, h)}
                  onRemove={() => removeHeader(index)}
                />
              ))
            ) : (
              <p className="text-gray-500 text-sm py-4 text-center">
                No headers configured. Headers can be used to add authentication or modify requests.
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
        </Section>

        {/* OpenTelemetry Collectors Section */}
        <Section title="OpenTelemetry Collectors" icon={Link2}>
          <div className="flex flex-col gap-4">
            {formData.otelUpstreams.length > 0 ? (
              formData.otelUpstreams.map((collector, collectorIndex) => (
                <div key={collectorIndex} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-gray-900">
                      Collector {collectorIndex + 1}
                    </h3>
                    <Button
                      type="text"
                      danger
                      onClick={() => removeOtelCollector(collectorIndex)}
                      icon={<Trash2 className="w-4 h-4" />}
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <input
                      type="url"
                      required
                      value={collector.url}
                      onChange={(e) => updateOtelCollector(collectorIndex, { ...collector, url: e.target.value })}
                      placeholder="https://otel-collector.example.com:4318"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />

                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-gray-700">Headers</label>
                      {collector.headers.map((header, headerIndex) => (
                        <HeaderRow
                          key={headerIndex}
                          header={header}
                          onChange={(h) => {
                            const newHeaders = [...collector.headers]
                            newHeaders[headerIndex] = h
                            updateOtelCollector(collectorIndex, { ...collector, headers: newHeaders })
                          }}
                          onRemove={() => {
                            const newHeaders = collector.headers.filter((_, i) => i !== headerIndex)
                            updateOtelCollector(collectorIndex, { ...collector, headers: newHeaders })
                          }}
                          showOverride={false}
                        />
                      ))}

                      <Button
                        size="small"
                        onClick={() => {
                          const newHeaders = [...collector.headers, { name: '', value: '', override: false }]
                          updateOtelCollector(collectorIndex, { ...collector, headers: newHeaders })
                        }}
                        icon={<Plus className="w-3 h-3" />}
                      >
                        Add Header
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm py-4 text-center">
                No OpenTelemetry collectors configured. Add collectors to send telemetry data.
              </p>
            )}

            <Button
              type="dashed"
              onClick={addOtelCollector}
              icon={<Plus className="w-4 h-4" />}
              className="w-full"
            >
              Add OpenTelemetry Collector
            </Button>
          </div>
        </Section>

        {/* Action Buttons */}
        <div className="flex items-center justify-between py-4">
          <Button
            onClick={() => router.push('/upstreams')}
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
    </form>
  )
}