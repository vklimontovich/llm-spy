'use client'

import { Typography, Collapse } from 'antd'
import { ToolOutlined, CodeOutlined, FileTextOutlined } from '@ant-design/icons'
import JsonView from './JsonView'
import styles from './ToolDeclarationView.module.css'

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
  parameters?: string | any  // Can be JSON string or object
}

interface ToolDeclarationViewProps {
  tools: Tool[]
}

const getParametersObject = (tool: Tool): any => {
  // Try to get parameters from different possible locations
  if (tool.input_schema) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { $schema, ...schemaWithoutMeta } = tool.input_schema
    return schemaWithoutMeta
  }
  
  if (tool.parameters) {
    if (typeof tool.parameters === 'string') {
      try {
        return JSON.parse(tool.parameters)
      } catch {
        return null
      }
    }
    return tool.parameters
  }
  
  return null
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
        
        {(() => {
          const paramsObj = getParametersObject(tool)
          
          if (!paramsObj) return null
          
          return (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CodeOutlined className="text-green-500" />
                <Text strong className="text-sm">Parameters:</Text>
              </div>
              <JsonView data={paramsObj} simple />
            </div>
          )
        })()}
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
        className={styles.toolDeclarationCollapse}
      />
    </div>
  )
}