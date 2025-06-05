'use client'

import { Typography, Tag, Collapse } from 'antd'
import { formatJson } from '@/lib/content-utils'
import { ToolOutlined, CodeOutlined, FileTextOutlined } from '@ant-design/icons'

const { Text } = Typography

interface ToolSchema {
  type?: string
  properties?: Record<string, any>
  required?: string[]
  additionalProperties?: boolean
  $schema?: string
}

interface Tool {
  name: string
  description: string
  input_schema?: ToolSchema
}

interface ToolDeclarationViewProps {
  tools: Tool[]
}

const formatSchema = (schema: ToolSchema | undefined) => {
  if (!schema) return null
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $schema, ...schemaWithoutMeta } = schema
  return formatJson(schemaWithoutMeta)
}

export default function ToolDeclarationView({ tools }: ToolDeclarationViewProps) {
  if (!tools || tools.length === 0) {
    return <Text className="text-gray-500">No tools declared</Text>
  }

  const toolItems = tools.map((tool, index) => ({
    key: `tool-${index}`,
    label: (
      <div className="flex items-center gap-2">
        <ToolOutlined className="text-blue-500" />
        <Text strong className="text-base">{tool.name}</Text>
      </div>
    ),
    children: (
      <div className="space-y-4">
        <div>
          <Text strong className="text-sm">Description:</Text>
          <div className="mt-1 p-3 bg-gray-50 rounded">
            <Text className="text-xs whitespace-pre-wrap">{tool.description}</Text>
          </div>
        </div>
        
        {tool.input_schema && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CodeOutlined className="text-green-500" />
              <Text strong className="text-sm">Input Schema:</Text>
            </div>
            <div className="p-3 bg-gray-900 rounded">
              <pre className="text-xs text-green-400 font-mono overflow-auto max-h-64">
                {formatSchema(tool.input_schema)}
              </pre>
            </div>
            
            {tool.input_schema.required && tool.input_schema.required.length > 0 && (
              <div className="mt-2">
                <Text className="text-xs text-gray-600">Required parameters: </Text>
                {tool.input_schema.required.map((param) => (
                  <Tag key={param} color="red" className="text-xs ml-1">
                    {param}
                  </Tag>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    ),
  }))

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <FileTextOutlined className="text-purple-500" />
        <Text className="text-sm text-gray-600">
          {tools.length} tool{tools.length > 1 ? 's' : ''} declared
        </Text>
      </div>
      <Collapse 
        items={toolItems} 
        defaultActiveKey={tools.length === 1 ? ['tool-0'] : []}
        className="tool-declaration-collapse"
      />
      <style jsx global>{`
        .tool-declaration-collapse .ant-collapse-header {
          padding: 12px 16px !important;
        }
        .tool-declaration-collapse .ant-collapse-content-box {
          padding: 16px !important;
        }
      `}</style>
    </div>
  )
}