export function isDisplayable(contentType: string | null): boolean {
  if (!contentType) return false
  const displayableTypes = [
    'application/json',
    'text/plain',
    'application/xml',
    'text/html',
    'text/css',
    'text/javascript',
    'text/event-stream'
  ]
  return displayableTypes.some(type => contentType.startsWith(type))
}

export function formatJson(input: any): string {
  if (typeof input === 'string') {
    try {
      return JSON.stringify(JSON.parse(input), null, 2)
    } catch {
      return input // Return as is if parsing fails
    }
  } else if (typeof input === 'object') {
    return JSON.stringify(input, null, 2)
  } else {
    return String(input) // Convert other types to string
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i]
}

export function parseEventStream(data: string): string {
  if (!data) return ''
  
  // Parse Server-Sent Events format
  const events = data.split('\n\n').filter(event => event.trim())
  let result = ''
  
  for (const event of events) {
    const lines = event.split('\n')
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const eventData = line.substring(6)
        if (eventData === '[DONE]') {
          result += '[STREAM END]\n'
        } else {
          try {
            const parsed = JSON.parse(eventData)
            result += JSON.stringify(parsed, null, 2) + '\n---\n'
          } catch {
            result += eventData + '\n'
          }
        }
      }
    }
  }
  
  return result || data
}

export function assembleStreamingResponse(data: string): PromptItem[] {
  if (!data) return []
  
  try {
    // Parse Server-Sent Events format
    const events = data.split('\n\n').filter(event => event.trim())
    const messages: { [key: string]: { role: string; content: string; model?: string } } = {}
    const contentBlocks: { [messageId: string]: { [index: number]: { type: string; content: string; toolName?: string } } } = {}
    
    for (const event of events) {
      const lines = event.split('\n')
      let eventData = ''
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          eventData = line.substring(6)
        }
      }
      
      if (!eventData) continue
      
      try {
        const parsed = JSON.parse(eventData)
        
        switch (parsed.type) {
          case 'message_start':
            if (parsed.message) {
              const messageId = parsed.message.id
              messages[messageId] = {
                role: parsed.message.role || 'assistant',
                content: '',
                model: parsed.message.model
              }
              contentBlocks[messageId] = {}
            }
            break
            
          case 'content_block_start':
            if (parsed.content_block) {
              const messageId = Object.keys(messages)[0]
              if (messageId) {
                const index = parsed.index || 0
                contentBlocks[messageId][index] = {
                  type: parsed.content_block.type,
                  content: '',
                  toolName: parsed.content_block.name
                }
              }
            }
            break
            
          case 'content_block_delta':
            const messageId = Object.keys(messages)[0]
            if (messageId) {
              const index = parsed.index || 0
              if (!contentBlocks[messageId][index]) {
                contentBlocks[messageId][index] = { type: 'unknown', content: '' }
              }
              
              if (parsed.delta && parsed.delta.type === 'text_delta') {
                contentBlocks[messageId][index].content += parsed.delta.text
              } else if (parsed.delta && parsed.delta.type === 'input_json_delta') {
                contentBlocks[messageId][index].content += parsed.delta.partial_json
              }
            }
            break
            
          case 'content_block_stop':
            // Content block is complete
            break
            
          case 'message_stop':
            // Message is complete
            break
        }
      } catch {
        // Skip invalid JSON
      }
    }
    
    // Assemble final messages
    const result: PromptItem[] = []
    
    for (const [messageId, message] of Object.entries(messages)) {
      // Combine all content blocks for this message
      const blocks = contentBlocks[messageId] || {}
      const sortedIndexes = Object.keys(blocks).map(Number).sort()
      
      if (sortedIndexes.length === 0) {
        // No content blocks, use message content if available
        if (message.content) {
          result.push({
            role: message.model ? `${message.role} (${message.model})` : message.role,
            content: message.content
          })
        }
      } else {
        // Process each content block
        for (const index of sortedIndexes) {
          const block = blocks[index]
          if (block.content) {
            let content = block.content
            let role = message.model ? `${message.role} (${message.model})` : message.role
            
            // Format tool use content
            if (block.type === 'tool_use' && block.toolName) {
              role += ` - ${block.toolName} Tool`
              try {
                // Try to format JSON if it's valid
                const parsed = JSON.parse(content)
                content = JSON.stringify(parsed, null, 2)
              } catch {
                // Keep as is if not valid JSON
              }
            }
            
            result.push({
              role,
              content
            })
          }
        }
      }
    }
    
    return result
  } catch {
    return []
  }
}

export function detectLLMResponse(body: string, contentType: string | null): boolean {
  if (!body) return false
  
  // Ensure body is a string
  const bodyStr = typeof body === 'string' ? body : String(body)
  
  // Check for streaming format
  if (contentType?.includes('text/event-stream')) {
    return bodyStr.includes('message_start') || bodyStr.includes('content_block_delta')
  }
  
  // Check for regular JSON response
  try {
    const parsed = JSON.parse(bodyStr)
    
    // Check for OpenAI/Anthropic response format
    if (parsed.choices && Array.isArray(parsed.choices)) {
      return true
    }
    
    // Check for Anthropic response format
    if (parsed.content && Array.isArray(parsed.content)) {
      return true
    }
    
    // Check for message format
    if (parsed.role && parsed.content) {
      return true
    }
    
    return false
  } catch {
    return false
  }
}

export function extractResponsePrompts(body: string, contentType: string | null): PromptItem[] {
  if (!body) return []
  
  // Ensure body is a string
  const bodyStr = typeof body === 'string' ? body : String(body)
  
  // Handle streaming format
  if (contentType?.includes('text/event-stream')) {
    return assembleStreamingResponse(bodyStr)
  }
  
  // Handle regular JSON response
  try {
    const parsed = JSON.parse(bodyStr)
    const prompts: PromptItem[] = []
    
    // Extract from OpenAI choices format
    if (parsed.choices && Array.isArray(parsed.choices)) {
      for (const choice of parsed.choices) {
        if (choice.message) {
          prompts.push({
            role: choice.message.role || 'assistant',
            content: choice.message.content || ''
          })
        }
      }
    }
    
    // Extract from Anthropic content format
    if (parsed.content && Array.isArray(parsed.content)) {
      for (const content of parsed.content) {
        if (content.type === 'text' && content.text) {
          prompts.push({
            role: parsed.role || 'assistant',
            content: content.text
          })
        }
      }
    }
    
    // Extract from direct message format
    if (parsed.role && parsed.content) {
      prompts.push({
        role: parsed.role,
        content: typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed.content)
      })
    }
    
    return prompts
  } catch {
    return []
  }
}

export function detectLLMRequest(body: string): boolean {
  if (!body) return false
  
  try {
    const parsed = JSON.parse(body)
    
    // Check for OpenAI/Anthropic-style messages
    if (parsed.messages && Array.isArray(parsed.messages)) {
      return true
    }
    
    // Check for system prompts
    if (parsed.system) {
      return true
    }
    
    // Check for tools declaration
    if (parsed.tools && Array.isArray(parsed.tools)) {
      return true
    }
    
    // Check for content array structure
    if (parsed.content && Array.isArray(parsed.content)) {
      return parsed.content.some((item: any) => 
        item.type === 'text' || item.type === 'image'
      )
    }
    
    // Check for prompt field
    if (typeof parsed.prompt === 'string') {
      return true
    }
    
    return false
  } catch {
    return false
  }
}

export function extractToolDeclarations(body: string): any[] {
  if (!body) return []
  
  try {
    const parsed = JSON.parse(body)
    
    if (parsed.tools && Array.isArray(parsed.tools)) {
      return parsed.tools
    }
    
    return []
  } catch {
    return []
  }
}

export interface PromptItem {
  role: string
  content: string | any
  type?: 'text' | 'tool_use' | 'tool_result'
  toolName?: string
  toolId?: string
}

export function extractPrompts(body: string): PromptItem[] {
  if (!body) return []
  
  try {
    const parsed = JSON.parse(body)
    const prompts: PromptItem[] = []
    
    // Extract system prompts first
    if (parsed.system) {
      if (typeof parsed.system === 'string') {
        prompts.push({
          role: 'system',
          content: parsed.system
        })
      } else if (Array.isArray(parsed.system)) {
        for (const systemItem of parsed.system) {
          if (systemItem.type === 'text' && systemItem.text) {
            prompts.push({
              role: 'system',
              content: systemItem.text
            })
          }
        }
      }
    }
    
    // Extract from messages array
    if (parsed.messages && Array.isArray(parsed.messages)) {
      for (const message of parsed.messages) {
        if (typeof message.content === 'string') {
          prompts.push({
            role: message.role || 'unknown',
            content: message.content
          })
        } else if (Array.isArray(message.content)) {
          // Group array content under the same role
          const contentItems: any[] = []
          for (const content of message.content) {
            if (content.type === 'text' && content.text) {
              contentItems.push({
                type: 'text',
                content: content.text
              })
            } else if (content.type === 'tool_use') {
              contentItems.push({
                type: 'tool_use',
                toolName: content.name,
                toolId: content.id,
                content: content.input
              })
            } else if (content.type === 'tool_result') {
              contentItems.push({
                type: 'tool_result',
                toolId: content.tool_use_id,
                content: content.content || content.output
              })
            }
          }
          
          if (contentItems.length > 0) {
            prompts.push({
              role: message.role || 'unknown',
              content: contentItems,
              type: 'text'
            })
          }
        }
      }
    }
    
    // Extract from content array
    if (parsed.content && Array.isArray(parsed.content)) {
      const contentItems: any[] = []
      for (const content of parsed.content) {
        if (content.type === 'text' && content.text) {
          contentItems.push({
            type: 'text',
            content: content.text
          })
        } else if (content.type === 'tool_use') {
          contentItems.push({
            type: 'tool_use',
            toolName: content.name,
            toolId: content.id,
            content: content.input
          })
        }
      }
      
      if (contentItems.length > 0) {
        prompts.push({
          role: parsed.role || 'assistant',
          content: contentItems,
          type: 'text'
        })
      }
    }
    
    // Extract from prompt field
    if (typeof parsed.prompt === 'string') {
      prompts.push({
        role: 'prompt',
        content: parsed.prompt
      })
    }
    
    return prompts
  } catch {
    return []
  }
}