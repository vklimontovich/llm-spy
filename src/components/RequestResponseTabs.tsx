'use client'

import { useQuery } from '@tanstack/react-query'
import { Tabs, Typography, Button, Collapse } from 'antd'
import { RequestResponse } from "@/app/(protected)/requests/page"
import { isDisplayable, formatJson, detectLLMRequest, extractPrompts, detectLLMResponse, extractResponsePrompts, extractToolDeclarations } from '@/lib/content-utils'
import HeadersTable from './HeadersTable'
import PromptView from './PromptView'
import ToolDeclarationView from './ToolDeclarationView'

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



  const renderContent = (isLoading: boolean, type: 'request' | 'response') => {
    if (isLoading) {
      return <div>Loading {type} data...</div>
    }

    const headers = type === 'request' ? selectedRequest.requestHeaders : selectedRequest.responseHeaders
    const contentType = getContentType(null, type)
    const shouldDisplayContent = getDisplayableStatus(type)
    const fetchedData = type === 'request' ? requestData : responseData
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

    const collapseItems = [
      {
        key: 'headers',
        label: 'Headers',
        children: <HeadersTable headers={headers} />
      },
      {
        key: 'body',
        label: 'Body',
        extra: contentType ? <Text code className="text-xs">{contentType}</Text> : undefined,
        children: shouldDisplayContent ? (
          <pre className="bg-gray-50 p-3 rounded text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap">
            {formatDisplayContent(type === 'request' ? requestData! : responseData!)}
          </pre>
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