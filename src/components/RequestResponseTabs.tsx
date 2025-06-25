'use client'

import { useQuery } from '@tanstack/react-query'
import { Tabs, Typography, Button, Collapse } from 'antd'
import { Download } from 'lucide-react'
import { RequestResponse } from "@/app/(protected)/requests/page"
import { isDisplayable, formatJson, detectLLMRequest, extractPrompts, detectLLMResponse, extractResponsePrompts, extractToolDeclarations } from '@/lib/content-utils'
import HeadersTable from './HeadersTable'
import PromptView from './PromptView'
import ToolDeclarationView from './ToolDeclarationView'
import { parseOtelTrace, otelSpansToPromptItems, otelSpansToToolDeclarations } from '@/lib/otel-parser'
import JsonView from './JsonView'
import SmartContentView from './SmartContentView'

const { Text } = Typography

interface RequestResponseTabsProps {
  selectedRequest: RequestResponse
  activeTab?: string
  onTabChange?: (tab: string) => void
}

export default function RequestResponseTabs({ selectedRequest, activeTab = 'request', onTabChange }: RequestResponseTabsProps) {
  const getContentType = (headers: any, type: 'request' | 'response') => {
    const headerObj = type === 'request' ? selectedRequest.requestHeaders : selectedRequest.responseHeaders;
    return headerObj?.['content-type'] || null;
  }

  const isProtobuf = (type: 'request' | 'response') => {
    const contentType = getContentType(null, type);
    return contentType?.includes('application/x-protobuf') || false;
  }

  const getDisplayableStatus = (type: 'request' | 'response') => {
    const contentType = getContentType(null, type);
    return isDisplayable(contentType);
  }

  // Fetch request data
  const { data: requestData, isLoading: requestLoading } = useQuery({
    queryKey: ['body', selectedRequest.id, 'request'],
    queryFn: async () => {
      const response = await fetch(`/api/body?id=${selectedRequest.id}&type=request`)
      if (!response.ok) throw new Error('Failed to fetch request')
      return response.text()
    },
    enabled: !!selectedRequest && getDisplayableStatus('request')
  })

  // Fetch response data
  const { data: responseData, isLoading: responseLoading } = useQuery({
    queryKey: ['body', selectedRequest.id, 'response'],
    queryFn: async () => {
      const response = await fetch(`/api/body?id=${selectedRequest.id}&type=response`)
      if (!response.ok) throw new Error('Failed to fetch response')
      return response.text()
    },
    enabled: !!selectedRequest && getDisplayableStatus('response')
  })

  // Fetch protobuf request data using server-side conversion
  const { data: protobufRequestData, isLoading: protobufRequestLoading } = useQuery({
    queryKey: ['protobuf', selectedRequest.id, 'request'],
    queryFn: async () => {
      const response = await fetch(`/api/body?id=${selectedRequest.id}&type=request&format=otel-json`)
      if (!response.ok) throw new Error('Failed to fetch request')
      return await response.text()
    },
    enabled: !!selectedRequest && isProtobuf('request')
  })

  // Fetch protobuf response data using server-side conversion
  const { data: protobufResponseData, isLoading: protobufResponseLoading } = useQuery({
    queryKey: ['protobuf', selectedRequest.id, 'response'],
    queryFn: async () => {
      const response = await fetch(`/api/body?id=${selectedRequest.id}&type=response&format=otel-json`)
      if (!response.ok) throw new Error('Failed to fetch response')
      return await response.text()
    },
    enabled: !!selectedRequest && isProtobuf('response')
  })



  const renderContent = (isLoading: boolean, type: 'request' | 'response') => {
    const protobufLoading = type === 'request' ? protobufRequestLoading : protobufResponseLoading
    const actuallyLoading = isLoading || protobufLoading

    if (actuallyLoading) {
      return <div>Loading {type} data...</div>
    }

    const headers = type === 'request' ? selectedRequest.requestHeaders : selectedRequest.responseHeaders
    const contentType = getContentType(null, type)
    const shouldDisplayContent = getDisplayableStatus(type)
    const isProtobufContent = isProtobuf(type)
    const fetchedData = type === 'request' ? requestData : responseData
    const protobufData = type === 'request' ? protobufRequestData : protobufResponseData
    const isLLMRequest = type === 'request' &&  (fetchedData && detectLLMRequest(fetchedData))
    const isLLMResponse = type === 'response' &&  (fetchedData && detectLLMResponse(fetchedData, contentType))
    const prompts = isLLMRequest ? extractPrompts(fetchedData || '') :
                   isLLMResponse ? extractResponsePrompts(fetchedData || '', contentType) : []
    const toolDeclarations = type === 'request' && isLLMRequest ? extractToolDeclarations(fetchedData || '') : []

    const formatDisplayContent = (rawData: string) => {
      if (contentType?.includes('text/event-stream')) {
        return rawData
      }
      return formatJson(rawData)
    }

    // Check if this is OTEL trace data
    let isOtelTrace = false
    let otelPrompts: any[] = []
    let otelToolDeclarations: any[] = []
    let parsedOtelData: any = null
    
    if (isProtobufContent && protobufData) {
      try {
        const parsed = parseOtelTrace(protobufData)
        if (parsed.spans.length > 0) {
          isOtelTrace = true
          parsedOtelData = parsed
          // Transform OTEL spans to prompt items
          otelPrompts = otelSpansToPromptItems(parsed.spans)
          // Extract tool declarations
          otelToolDeclarations = otelSpansToToolDeclarations(parsed.spans)
        }
      } catch {
        // Not valid OTEL trace data
      }
    }

    const collapseItems = [
      {
        key: 'headers',
        label: 'Headers',
        children: <HeadersTable headers={headers} />
      },
      {
        key: 'body',
        label: 'Body',
        extra: contentType ? (
          <div className="flex items-center gap-2">
            <Text code className="text-xs">{contentType}</Text>
            {isProtobufContent && (
              <Button
                href={`/api/body?id=${selectedRequest.id}&type=${type}&download=true`}
                target="_blank"
                type="text"
                size="small"
                icon={<Download size={12} />}
                className="text-gray-500 hover:text-gray-700"
                title={`Download ${type === 'request' ? 'Request' : 'Response'} Body`}
              />
            )}
          </div>
        ) : undefined,
        children: shouldDisplayContent ? (
          <div className="bg-gray-50 p-3 rounded">
            {isProtobufContent ? (
              <SmartContentView data={protobufData} />
            ) : (
              <pre className="text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap text-gray-800 leading-relaxed">
                {formatDisplayContent(type === 'request' ? requestData! : responseData!)}
              </pre>
            )}
          </div>
        ) : (
          <div>
            <Button href={`/api/body?id=${selectedRequest.id}&type=${type}&download=true`} target="_blank" type="primary">
              Download {type === 'request' ? 'Request' : 'Response'} Body
            </Button>
          </div>
        )
      }
    ]

    // Add tool declarations section for requests
    if (type === 'request' && isLLMRequest && toolDeclarations.length > 0) {
      collapseItems.push({
        key: 'tools',
        label: 'Tool Declarations',
        extra: <Text className="text-xs">{toolDeclarations.length} tool{toolDeclarations.length > 1 ? 's' : ''}</Text>,
        children: <ToolDeclarationView tools={toolDeclarations} />
      })
    }

    if ((isLLMRequest || isLLMResponse) && prompts.length > 0) {
      collapseItems.push({
        key: 'prompts',
        label: type === 'request' ? 'Prompt View' : 'Response View',
        extra: <Text className="text-xs">{prompts.length} {type === 'request' ? 'prompt' : 'message'}{prompts.length > 1 ? 's' : ''}</Text>,
        children: <PromptView prompts={prompts} />
      })
    }
    
    // Add OTEL trace view if applicable
    if (isOtelTrace && otelPrompts.length > 0) {
      collapseItems.push({
        key: 'otel-prompts',
        label: 'OTEL Trace Prompts',
        extra: <Text className="text-xs">{otelPrompts.length} prompt{otelPrompts.length > 1 ? 's' : ''}</Text>,
        children: <PromptView prompts={otelPrompts} />
      })
    }
    
    // Add OTEL tool declarations if present
    if (isOtelTrace && otelToolDeclarations.length > 0) {
      collapseItems.push({
        key: 'otel-tools',
        label: 'Tool Declarations',
        extra: <Text className="text-xs">{otelToolDeclarations.length} tool{otelToolDeclarations.length > 1 ? 's' : ''}</Text>,
        children: <ToolDeclarationView tools={otelToolDeclarations} />
      })
    }
    
    if (isOtelTrace && parsedOtelData) {
      // Add parsed OTEL data for debugging
      collapseItems.push({
        key: 'otel-parsed',
        label: 'OTEL Parsed Data (Debug)',
        extra: <Text className="text-xs">Raw parsed structure</Text>,
        children: (
          <div className="bg-gray-50 p-3 rounded">
            <JsonView data={parsedOtelData} />
          </div>
        )
      })
    }

    return (
      <div className="space-y-4">
        <Collapse
          items={collapseItems}
          size="small"
        />
      </div>
    )
  }

  return (
    <Tabs
      activeKey={activeTab}
      onChange={onTabChange}
      items={[
        {
          key: 'request',
          label: 'Request',
          children: renderContent(requestLoading, 'request')
        },
        {
          key: 'response',
          label: 'Response',
          children: renderContent(responseLoading, 'response')
        }
      ]}
    />
  )
}