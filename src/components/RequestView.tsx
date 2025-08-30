'use client'

import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { memo } from 'react'
import { Tabs, Card, Badge, Spin, Collapse, Typography } from 'antd'
import {
  MessageSquare,
  FileCode,
  FileJson,
  Wrench,
  Database,
  Clock,
  Hash,
} from 'lucide-react'
import HeadersTable from './HeadersTable'
import ChatView from './ChatView'
import ToolDeclarationView from './ToolDeclarationView'
import JsonView from './JsonView'
import SmartContentView from './SmartContentView'
import { LlmRequest } from '@/lib/route-types'
import { isSSEResponse, parseSSEEvents } from '@/lib/sse-utils'
import axios from 'axios'
import { getParserForProvider } from '@/lib/format'
import { requireDefined } from '@/lib/preconditions'

const { Text } = Typography

interface RequestViewProps {
  requestId: string
  workspaceId?: string
}

// Memoized Chat Tab Component
const ChatTab = memo(({ llmRequest }: { llmRequest: LlmRequest }) => {
  if (!llmRequest?.conversation) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <MessageSquare className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No Conversation Data
        </h3>
        <p className="text-gray-500 text-center max-w-md">
          This request does not appear to be an AI conversation. Check the Raw
          Request and Raw Response tabs for details.
        </p>
      </div>
    )
  }

  const { conversation } = llmRequest
  const collapseItems: any[] = []

  if (conversation.modelMessages && conversation.modelMessages.length > 0) {
    collapseItems.push({
      key: 'chat',
      label: (
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          <span className="font-medium">Chat Messages</span>
        </div>
      ),
      extra: (
        <Badge
          count={conversation.modelMessages.length}
          style={{ backgroundColor: '#52c41a' }}
        />
      ),
      children: <ChatView messages={conversation.modelMessages} />,
    })
  }

  if (conversation.tools && conversation.tools.length > 0) {
    collapseItems.push({
      key: 'tools',
      label: (
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4" />
          <span className="font-medium">Tool Declarations</span>
        </div>
      ),
      extra: (
        <Badge
          count={conversation.tools.length}
          style={{ backgroundColor: '#722ed1' }}
        />
      ),
      children: (
        <Card className="bg-gray-50 border-0">
          <ToolDeclarationView tools={conversation.tools} />
        </Card>
      ),
    })
  }

  if (conversation.meta) {
    collapseItems.push({
      key: 'meta',
      label: (
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4" />
          <span className="font-medium">Metadata</span>
        </div>
      ),
      children: (
        <Card className="bg-gray-50 border-0">
          <JsonView data={conversation.meta} />
        </Card>
      ),
    })
  }

  return (
    <div className="p-4">
      <Collapse
        items={collapseItems}
        defaultActiveKey={['chat']}
        className="bg-white border-gray-200"
        expandIconPosition="end"
      />
    </div>
  )
})
ChatTab.displayName = 'ChatTab'

// Memoized Request Tab Component
const RequestTab = memo(({ llmRequest }: { llmRequest: LlmRequest }) => {
  const collapseItems = [
    {
      key: 'headers',
      label: (
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4" />
          <span className="font-medium">Headers</span>
        </div>
      ),
      extra: llmRequest?.rawRequest?.headers && (
        <Badge
          count={Object.keys(llmRequest.rawRequest.headers).length}
          style={{ backgroundColor: '#1890ff' }}
        />
      ),
      children: (
        <Card className="bg-gray-50 border-0">
          <HeadersTable headers={llmRequest?.rawRequest?.headers} />
        </Card>
      ),
    },
    {
      key: 'body',
      label: (
        <div className="flex items-center gap-2">
          <FileJson className="w-4 h-4" />
          <span className="font-medium">Request Body</span>
        </div>
      ),
      extra: llmRequest?.rawRequest?.headers?.['content-type'] && (
        <Text
          code
          className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded"
        >
          {llmRequest.rawRequest.headers['content-type']}
        </Text>
      ),
      children: llmRequest?.rawRequest?.body ? (
        <Card className="bg-gray-50 border-0">
          <SmartContentView data={llmRequest.rawRequest.body} />
        </Card>
      ) : (
        <div className="flex justify-center py-8">
          <Text type="secondary">No request body available</Text>
        </div>
      ),
    },
  ]

  return (
    <div className="p-4">
      <Collapse
        items={collapseItems}
        defaultActiveKey={['body']}
        className="bg-white border-gray-200"
        expandIconPosition="end"
      />
    </div>
  )
})
RequestTab.displayName = 'RequestTab'

// Memoized Response Tab Component
const ResponseTab = memo(({ llmRequest }: { llmRequest: LlmRequest }) => {
  const collapseItems = [
    {
      key: 'headers',
      label: (
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4" />
          <span className="font-medium">Headers</span>
        </div>
      ),
      extra: llmRequest?.rawResponse?.headers && (
        <Badge
          count={Object.keys(llmRequest.rawResponse.headers).length}
          style={{ backgroundColor: '#1890ff' }}
        />
      ),
      children: (
        <Card className="bg-gray-50 border-0">
          <HeadersTable headers={llmRequest?.rawResponse?.headers} />
        </Card>
      ),
    },
    {
      key: 'body',
      label: (
        <div className="flex items-center gap-2">
          <FileJson className="w-4 h-4" />
          <span className="font-medium">Response Body</span>
        </div>
      ),
      extra: llmRequest?.rawResponse?.headers?.['content-type'] && (
        <Text
          code
          className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded"
        >
          {llmRequest.rawResponse.headers['content-type']}
        </Text>
      ),
      children: llmRequest?.rawResponse?.body ? (
        <Card className="bg-gray-50 border-0">
          <SmartContentView data={llmRequest.rawResponse.body} />
        </Card>
      ) : (
        <div className="flex justify-center py-8">
          <Text type="secondary">No response body available</Text>
        </div>
      ),
    },
  ]

  // Add SSE reconstruction if response is SSE
  if (isSSEResponse(llmRequest?.rawResponse?.headers)) {
    const events = parseSSEEvents(llmRequest.rawResponse.body)
    let eventsToDisplay
    if (llmRequest.provider) {
      const provider = requireDefined(
        getParserForProvider(llmRequest.provider),
        `No parser found for provider ${llmRequest.provider}`
      )
      if (provider) {
        eventsToDisplay = provider.parseSSE(events)
      }
    } else {
      eventsToDisplay = events
    }

    if (events.length > 0) {
      collapseItems.push({
        key: 'sse-events',
        label: (
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span className="font-medium">Streamed Events</span>
          </div>
        ),
        extra: (
          <Badge
            count={`${events.length} events`}
            style={{ backgroundColor: '#fa8c16' }}
          />
        ),
        children: (
          <Card className="bg-gray-50 border-0">
            <SmartContentView data={eventsToDisplay} />
          </Card>
        ),
      })
    }
  }

  return (
    <div className="p-4">
      <Collapse
        items={collapseItems}
        defaultActiveKey={['body']}
        className="bg-white border-gray-200"
        expandIconPosition="end"
      />
    </div>
  )
})
ResponseTab.displayName = 'ResponseTab'

export default function RequestView({
  requestId,
  workspaceId,
}: RequestViewProps) {
  const searchParams = useSearchParams()

  // Get tab from URL params, default to 'chat'
  const tabFromUrl = searchParams.get('tab')
  const validTabs = ['chat', 'request', 'response']
  const currentTab =
    tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'chat'

  // Fetch combined data (request, response, and conversation)
  const { data: combinedData, isLoading } = useQuery({
    queryKey: ['body', requestId, 'combined'],
    queryFn: async () => {
      const config = workspaceId
        ? {
            params: { id: requestId },
            headers: { 'X-Workspace-Id': workspaceId },
          }
        : {
            params: { id: requestId },
          }
      const response = await axios.get('/api/body', config)
      return response.data
    },
    enabled: !!requestId,
  })

  const handleTabChange = (key: string) => {
    // Update URL with new tab
    const params = new URLSearchParams(window.location.search)
    params.set('tab', key)
    const newUrl = `${window.location.pathname}?${params.toString()}`
    window.history.pushState({}, '', newUrl)
  }

  // Show loading state for all tabs
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    )
  }

  // Memoize tab items to prevent re-renders
  const tabItems = [
    {
      key: 'chat',
      label: (
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          <span>Chat View</span>
        </div>
      ),
      children: (
        <div style={{ display: currentTab === 'chat' ? 'block' : 'none' }}>
          <ChatTab llmRequest={combinedData} />
        </div>
      ),
    },
    {
      key: 'request',
      label: (
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4" />
          <span>Raw Request</span>
        </div>
      ),
      children: (
        <div style={{ display: currentTab === 'request' ? 'block' : 'none' }}>
          <RequestTab llmRequest={combinedData} />
        </div>
      ),
    },
    {
      key: 'response',
      label: (
        <div className="flex items-center gap-2">
          <FileJson className="w-4 h-4" />
          <span>Raw Response</span>
        </div>
      ),
      children: (
        <div style={{ display: currentTab === 'response' ? 'block' : 'none' }}>
          <ResponseTab llmRequest={combinedData} />
        </div>
      ),
    },
  ]

  return (
    <div className="">
      <Tabs
        activeKey={currentTab}
        onChange={handleTabChange}
        items={tabItems}
        destroyOnHidden={true}
        className="request-view-tabs"
        size="large"
      />
    </div>
  )
}
