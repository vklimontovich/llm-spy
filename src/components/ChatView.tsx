'use client'

import { Typography, Badge } from 'antd'
import { User, Bot, Settings, Wrench, MessageSquare } from 'lucide-react'
import SmartContentView from './SmartContentView'
import type { ModelMessage } from 'ai'

const { Text } = Typography

interface ChatViewProps {
  messages: ModelMessage[]
}

type GroupedMessage = {
  messages: ModelMessage[]
  role: 'system' | 'user' | 'assistant'
  groupId: string | undefined
}

const getRoleConfig = (role: string) => {
  switch (role.toLowerCase()) {
    case 'user':
      return {
        color: '#3b82f6',
        bgColor: '#f0f9ff',
        icon: User,
        label: 'User'
      }
    case 'assistant':
      return {
        color: '#10b981',
        bgColor: '#f0fdf4',
        icon: Bot,
        label: 'Assistant'
      }
    case 'system':
      return {
        color: '#f97316',
        bgColor: '#fff7ed',
        icon: Settings,
        label: 'System'
      }
    default:
      return {
        color: '#6b7280',
        bgColor: '#f9fafb',
        icon: MessageSquare,
        label: role
      }
  }
}

function groupMessages(messages: ModelMessage[]): GroupedMessage[] {
  const groups: GroupedMessage[] = []

  for (const message of messages) {
    const groupId = (message as any).providerOptions?.originalMessageGroup

    // Split messages with array content into individual messages
    if (Array.isArray(message.content) && message.content.length > 1) {
      // Create a group for multi-part messages
      const splitMessages: ModelMessage[] = message.content.map((part) => ({
        ...message,
        content: [part] // Each message now has single content item
      }))

      // Determine group role
      let groupRole: 'system' | 'user' | 'assistant' = message.role === 'tool' ? 'user' : message.role as any

      if (groupId !== undefined) {
        // Add to existing group or create new one
        let group = groups.find(g => g.groupId === groupId)
        if (!group) {
          group = {
            messages: [],
            role: groupRole,
            groupId
          }
          groups.push(group)
        }
        group.messages.push(...splitMessages)
        if (message.role === 'tool') {
          group.role = 'user'
        }
      } else {
        // Create new group for these split messages
        groups.push({
          messages: splitMessages,
          role: groupRole,
          groupId: `split-${groups.length}` // Synthetic group ID
        })
      }
    } else {
      // Single content item or string content
      if (groupId !== undefined) {
        let group = groups.find(g => g.groupId === groupId)
        if (!group) {
          const groupRole: 'system' | 'user' | 'assistant' = message.role === 'tool' ? 'user' : message.role as any
          group = {
            messages: [],
            role: groupRole,
            groupId
          }
          groups.push(group)
        }
        group.messages.push(message)
        if (message.role === 'tool') {
          group.role = 'user'
        }
      } else {
        // No group, add as single message group
        const role = message.role === 'tool' ? 'user' : message.role as any
        groups.push({
          messages: [message],
          role: role,
          groupId: undefined
        })
      }
    }
  }

  return groups
}

function getMessageAnnotation(message: ModelMessage): string | null {
  const { role, content } = message

  // Since content is now always single item, check first item
  if (role === 'assistant' && Array.isArray(content) && content.length === 1) {
    if (content[0].type === 'tool-call') {
      return 'Tool Call'
    }
  }

  if (role === 'tool' && Array.isArray(content) && content.length === 1) {
    if (content[0].type === 'tool-result') {
      return 'Tool Result'
    }
  }

  return null
}

// Message Content Component
function MessageContent({ message }: { message: ModelMessage }) {
  const { role, content } = message

  // Handle system messages (always string)
  if (role === 'system') {
    return <SmartContentView data={content} />
  }

  // Handle string content (simple user messages)
  if (typeof content === 'string') {
    return <SmartContentView data={content} />
  }

  // Handle array content (should be single item now)
  if (Array.isArray(content) && content.length === 1) {
    const part = content[0]

    switch (part.type) {
      case 'text':
        return <SmartContentView data={part.text} />

      case 'image':
        return (
          <div>
            <Text className="text-xs text-gray-500 mb-1">Image</Text>
            <SmartContentView data={'image' in part ? part.image : part.data} />
          </div>
        )

      case 'file':
        return (
          <div>
            <Text className="text-xs text-gray-500 mb-1">File</Text>
            <SmartContentView data={part.data} />
          </div>
        )

      case 'tool-call':
        return (
          <div>
            <div className="mb-2">
              <Wrench className="inline w-4 h-4 text-gray-500 mr-2" />
              <Text className="text-sm text-gray-600">Tool Call</Text>
              <Text className="text-sm font-medium ml-2">{part.toolName || 'unknown'}</Text>
            </div>
            <div className="">
              <SmartContentView
                data={'args' in part ? part.args : ('arguments' in part ? part.arguments : {})}
              />
            </div>
          </div>
        )

      case 'tool-result':
        return (
          <div>
            <div className="mb-2">
              <Wrench className="inline w-4 h-4 text-gray-500 mr-2" />
              <Text className="text-sm text-gray-600">Tool Result</Text>
              <Text className="text-sm font-medium ml-2">{part.toolName || 'unknown'}</Text>
            </div>
            <div className="pl-6">
              <SmartContentView
                data={typeof part.output === 'object' && part.output && 'value' in part.output
                  ? part.output.value
                  : part.output}
              />
            </div>
          </div>
        )

      default:
        return <SmartContentView data={part} />
    }
  }

  // Fallback for unexpected structure
  return <SmartContentView data={content} />
}

// Message Group View Component
function MessageGroupView({ group }: { group: GroupedMessage }) {
  const roleConfig = getRoleConfig(group.role)
  const IconComponent = roleConfig.icon

  // Single message
  if (group.messages.length === 1) {
    const message = group.messages[0]
    const annotation = getMessageAnnotation(message)

    return (
      <div
        className="w-full rounded-lg px-4 py-3"
        style={{ backgroundColor: roleConfig.bgColor }}
      >
        <div className="flex items-center gap-2 mb-2">
          <IconComponent className="w-4 h-4" style={{ color: roleConfig.color }} />
          <span
            className="text-sm font-semibold"
            style={{ color: roleConfig.color }}
          >
            {roleConfig.label}
          </span>
          {annotation && (
            <>
              <span className="text-sm text-gray-400">•</span>
              <span className="text-sm text-gray-600">{annotation}</span>
            </>
          )}
        </div>
        <div className="text-gray-800">
          <MessageContent message={message} />
        </div>
      </div>
    )
  }

  // Multiple messages
  return (
    <div
      className="w-full rounded-lg px-4 py-3"
      style={{ backgroundColor: roleConfig.bgColor }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <IconComponent className="w-4 h-4" style={{ color: roleConfig.color }} />
        <span
          className="text-sm font-semibold"
          style={{ color: roleConfig.color }}
        >
          {roleConfig.label}
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: roleConfig.color }}
        >
          {group.messages.length} content items
        </span>
      </div>

      {/* Messages with visible dividers */}
      <div>
        {group.messages.map((message, idx) => (
          <div key={idx}>
            {idx > 0 && (
              <div
                className="h-[2px] my-3 bg-gray-200"
              />
            )}
            <div className="text-gray-800">
              <MessageContent message={message} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ChatView({ messages }: ChatViewProps) {
  if (!messages || messages.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
        <Text>No messages to display</Text>
      </div>
    )
  }

  const groupedMessages = groupMessages(messages)

  return (
    <div className="space-y-3">
      {groupedMessages.map((group, index) => (
        <MessageGroupView key={index} group={group} />
      ))}
    </div>
  )
}