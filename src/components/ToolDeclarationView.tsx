'use client'

import { Typography, Collapse } from 'antd'
import { ToolOutlined, CodeOutlined } from '@ant-design/icons'
import JsonView from './JsonView'
import styles from './ToolDeclarationView.module.css'
import { Tool } from 'ai'

const { Text } = Typography



interface ToolDeclarationViewProps {
  tools: Tool[]
}

const getParametersObject = (tool: Tool): any => {
  // Try to get parameters from different possible locations
  if (tool.inputSchema) {
    // AI SDK format - inputSchema is a FlexibleSchema which can be:
    // 1. A Zod schema (has _def property)
    // 2. A Schema object (has jsonSchema property)
    // 3. A custom validator
    
    // Check if it's a Schema object with jsonSchema
    if ('jsonSchema' in tool.inputSchema && tool.inputSchema.jsonSchema) {
      const jsonSchema = tool.inputSchema.jsonSchema
      // Remove $schema and other metadata
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { $schema, ...schemaWithoutMeta } = jsonSchema as any
      return schemaWithoutMeta
    }
    
    // For Zod schemas or other types, we can't easily extract the schema
    // Return a placeholder or try to describe it
    if ('_def' in tool.inputSchema) {
      // It's a Zod schema - we can't easily convert it to JSON schema
      return { type: 'zod-schema', description: 'Complex schema' }
    }
    
    return tool.inputSchema
  }

  // Legacy format support
  if ((tool as any).input_schema) {
    const inputSchema = (tool as any).input_schema
    if (inputSchema.$schema) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { $schema, ...schemaWithoutMeta } = inputSchema
      return schemaWithoutMeta
    }
    return inputSchema
  }

  if ((tool as any).parameters) {
    const params = (tool as any).parameters
    if (typeof params === 'string') {
      try {
        return JSON.parse(params)
      } catch {
        return null
      }
    }
    return params
  }

  return null
}


export default function ToolDeclarationView({ tools }: ToolDeclarationViewProps) {
  if (!tools || tools.length === 0) {
    return <Text className="text-gray-500">No tools declared</Text>
  }

  const toolItems = tools.map((tool, index) => {
    // Get tool name - it's in the 'name' property for provider-defined tools
    // For other tools, we might need to generate a name or use index
    const toolName = (tool as any).name || `Tool ${index + 1}`
    
    return {
      key: `tool-${index}`,
      label: (
        <div className="flex items-center gap-2">
          <ToolOutlined className="text-blue-500" />
          <Text strong className="text-base">{toolName}</Text>
        </div>
      ),
      children: (
        <div className="space-y-4">
          {tool.description && (
            <div>
              <Text strong className="text-sm">Description:</Text>
              <div className="mt-1 p-3 bg-gray-50 rounded">
                <Text className="text-xs whitespace-pre-wrap">{tool.description}</Text>
              </div>
            </div>
          )}

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
    }
  })

  return (
    <div className="space-y-3">
      <Collapse
        items={toolItems}
        defaultActiveKey={tools.length === 1 ? ['tool-0'] : []}
        className={styles.toolDeclarationCollapse}
      />
    </div>
  )
}