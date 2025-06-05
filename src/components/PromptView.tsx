'use client'

import { Typography, Tag, Divider } from 'antd'
import { PromptItem } from '@/lib/content-utils'
import { formatJson } from '@/lib/content-utils'
import { User, Bot, Settings, Wrench, CheckCircle, MessageSquare, FileText } from 'lucide-react'

const { Text } = Typography

interface PromptViewProps {
  prompts: PromptItem[]
}

const getRoleConfig = (role: string) => {
  switch (role.toLowerCase()) {
    case 'user':
      return { color: 'blue', icon: User }
    case 'assistant':
      return { color: 'green', icon: Bot }
    case 'system':
      return { color: 'orange', icon: Settings }
    case 'prompt':
      return { color: 'purple', icon: MessageSquare }
    case 'content':
      return { color: 'cyan', icon: FileText }
    default:
      return { color: 'default', icon: MessageSquare }
  }
}

const getToolConfig = (type: string) => {
  switch (type) {
    case 'tool_use':
      return { color: 'blue', icon: Wrench }
    case 'tool_result':
      return { color: 'green', icon: CheckCircle }
    default:
      return { color: 'default', icon: null }
  }
}

const renderContent = (content: string | any, singleItem?: any) => {
  // If we have a single item from an array, render it directly
  if (singleItem) {
    if (singleItem.type === 'text') {
      return (
        <pre className="text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap text-gray-800 leading-relaxed">
          {singleItem.content}
        </pre>
      )
    } else if (singleItem.type === 'tool_use' || singleItem.type === 'tool_result') {
      return (
        <pre className="text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap text-gray-800 leading-relaxed">
          {formatJson(singleItem.content)}
        </pre>
      )
    }
  }

  if (typeof content === 'string') {
    return (
      <pre className="text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap text-gray-800 leading-relaxed">
        {content}
      </pre>
    )
  }

  if (Array.isArray(content)) {
    // Multiple items - show them with dividers
    return (
      <div className="space-y-3">
        {content.map((item, idx) => (
          <div key={idx}>
            {item.type === 'text' && (
              <pre className="text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap text-gray-800 leading-relaxed">
                {item.content}
              </pre>
            )}
            {item.type === 'tool_use' && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-blue-700">Tool: {item.toolName}</span>
                </div>
                <pre className="text-xs font-mono overflow-auto max-h-64 whitespace-pre-wrap text-gray-700">
                  {formatJson(item.content)}
                </pre>
              </div>
            )}
            {item.type === 'tool_result' && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-green-700">Tool Result</span>
                </div>
                <pre className="text-xs font-mono overflow-auto max-h-64 whitespace-pre-wrap text-gray-700">
                  {typeof item.content === 'string' ? item.content : formatJson(item.content)}
                </pre>
              </div>
            )}
            {idx < content.length - 1 && <Divider className="my-2" />}
          </div>
        ))}
      </div>
    )
  }

  // Fallback for other types
  return (
    <pre className="text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap text-gray-800 leading-relaxed">
      {formatJson(content)}
    </pre>
  )
}

export default function PromptView({ prompts }: PromptViewProps) {
  if (!prompts || prompts.length === 0) {
    return <Text>No prompts detected</Text>
  }

  return (
    <div className="space-y-3">
      {prompts.map((prompt, index) => {
        // Check if this is a single-item array
        const isSingleItemArray = Array.isArray(prompt.content) && prompt.content.length === 1
        const singleItem = isSingleItemArray ? prompt.content[0] : null

        return (
          <div
            key={index}
            className="border border-gray-200 rounded-lg p-4 bg-gray-50"
          >
            <div className="mb-3 flex items-center gap-2">
              {(() => {
                const roleConfig = getRoleConfig(prompt.role)
                const IconComponent = roleConfig.icon
                return (
                  <Tag
                    color={roleConfig.color}
                  >
                    <div className="text-sm font-medium flex flex-nowrap flex-row items-center gap-1 uppercase">
                      {IconComponent && <IconComponent className="w-3 h-3 border-dotted" />}
                      <span>
                      {prompt.role}
                    </span>
                    </div>
                  </Tag>
                )
              })()}
              {singleItem && singleItem.type === 'tool_use' && (
                <>
                  <Tag
                    color={getToolConfig('tool_use').color}
                    className=""
                  >
                    <div className="text-sm font-medium flex items-center gap-1 uppercase">

                      <Wrench className="w-3 h-3" />
                      Tool Use
                    </div>
                  </Tag>
                  <span className="text-xs font-semibold text-blue-700">{singleItem.toolName}</span>
                </>
              )}
              {singleItem && singleItem.type === 'tool_result' && (
                <Tag
                  color={getToolConfig('tool_result').color}
                  className=""
                >
                  <div className="text-sm font-medium flex items-center gap-1 uppercase">
                    <CheckCircle className="w-3 h-3" />
                    Tool Result

                  </div>
                </Tag>
              )}
            </div>
            {isSingleItemArray
              ? renderContent(null, singleItem)
              : renderContent(prompt.content)
            }
          </div>
        )
      })}
    </div>
  )
}