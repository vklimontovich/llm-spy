'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  Input,
  Select,
  Button,
  Alert,
  Typography,
  Collapse,
  Badge,
} from 'antd'
import { FileJson, MessageSquare, Wrench } from 'lucide-react'
import ChatView from '@/components/ChatView'
import ToolDeclarationView from '@/components/ToolDeclarationView'
import { getParserForProvider } from '@/lib/format'
import type { ModelMessage, Tool } from 'ai'
import { useRouter } from 'next/navigation'

const { TextArea } = Input
const { Title, Text } = Typography

const providers = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'google', label: 'Google' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'cohere', label: 'Cohere' },
  { value: 'meta', label: 'Meta' },
]

interface ChatViewToolPageProps {
  defaultProvider?: string
}

export default function ChatViewToolPage({
  defaultProvider = 'anthropic',
}: ChatViewToolPageProps) {
  const router = useRouter()
  const [provider, setProvider] = useState(defaultProvider)
  const [jsonInput, setJsonInput] = useState('')
  const [messages, setMessages] = useState<ModelMessage[] | null>(null)
  const [tools, setTools] = useState<Tool[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Update provider when defaultProvider changes
  useEffect(() => {
    if (defaultProvider && providers.some(p => p.value === defaultProvider)) {
      setProvider(defaultProvider)
    }
  }, [defaultProvider])

  const handleParse = () => {
    setError(null)
    setMessages(null)
    setTools(null)

    if (!jsonInput.trim()) {
      setError('Please enter JSON data')
      return
    }

    try {
      const parsed = JSON.parse(jsonInput)
      console.log('Parsed JSON:', parsed)
      console.log('Provider:', provider)

      const parser = getParserForProvider(provider)
      console.log('Parser:', parser)

      if (!parser) {
        // If no parser available, try to use the data directly as messages
        if (Array.isArray(parsed)) {
          setMessages(parsed as ModelMessage[])
        } else if (parsed.messages && Array.isArray(parsed.messages)) {
          setMessages(parsed.messages as ModelMessage[])
        } else {
          console.error(`No parser available for provider: ${provider}`)
          setError(
            `No parser available for provider: ${provider}. JSON must contain a messages array.`
          )
        }
        // Check for tools in raw parsed data
        if (parsed.tools && Array.isArray(parsed.tools)) {
          setTools(parsed.tools as Tool[])
        }
        return
      }

      // Use the parser's createConversation method to convert provider format to model messages
      try {
        const conversation = parser.createConversation(parsed)
        console.log('Conversation:', conversation)

        if (conversation) {
          if (conversation.modelMessages) {
            setMessages(conversation.modelMessages)
          }
          if (conversation.tools && conversation.tools.length > 0) {
            setTools(conversation.tools)
          }
        } else {
          console.error(
            'Failed to parse JSON into conversation format',
            conversation
          )
          setError('Failed to parse JSON into conversation format')
        }
      } catch (parseError) {
        console.error('Error in createConversation:', parseError)
        setError(
          `Parser error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        )
      }
    } catch (e) {
      console.error('JSON parsing error:', e)
      setError(
        `Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`
      )
    }
  }

  const handleExampleLoad = () => {
    // Load an example based on selected provider
    const examples: Record<string, any> = {
      anthropic: {
        model: 'claude-3-opus-20240229',
        messages: [
          {
            role: 'user',
            content: 'What is the capital of France?',
          },
          {
            role: 'assistant',
            content: 'The capital of France is Paris.',
          },
        ],
        max_tokens: 1024,
      },
      openai: {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant.',
          },
          {
            role: 'user',
            content: 'Hello!',
          },
          {
            role: 'assistant',
            content: 'Hello! How can I help you today?',
          },
        ],
      },
    }

    const example = examples[provider] || examples.anthropic
    setJsonInput(JSON.stringify(example, null, 2))
  }

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider)
    // Update URL to match new provider if we have a dynamic route
    if (
      defaultProvider !== 'anthropic' ||
      window.location.pathname.includes('/chat-view/')
    ) {
      router.push(`/tools/chat-view/${newProvider}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-2">
      <div className="min-w-[1000px] max-w-[2000px] mx-auto px-4 overflow-x-auto">
        {/* Compact Header */}
        <div className="mb-2 flex items-center gap-3">
          <MessageSquare className="w-5 h-5" />
          <Title level={4} className="mb-0">
            Chat View Tool
          </Title>
          <Text type="secondary" className="text-sm">
            Parse and visualize LLM conversations
          </Text>
        </div>

        {/* Main Content - Vertical Layout */}
        <div className="flex flex-col gap-3 h-[calc(100vh-60px)]">
          {/* Top - Input */}
          <Card
            size="small"
            styles={{ body: { padding: '8px' } }}
            title={
              <div className="flex items-center justify-between">
                <span className="text-sm">Input</span>
                <div className="flex items-center gap-2">
                  <Text className="mr-1 text-xs">Provider:</Text>
                  <Select
                    value={provider}
                    onChange={handleProviderChange}
                    options={providers}
                    className="w-28"
                    size="small"
                  />
                  <Button
                    type="link"
                    onClick={handleExampleLoad}
                    icon={<FileJson className="w-3 h-3" />}
                    size="small"
                    className="text-xs"
                  >
                    Example
                  </Button>
                  <Button type="primary" onClick={handleParse} size="small">
                    Parse
                  </Button>
                </div>
              </div>
            }
          >
            <div className="flex flex-col gap-2">
              <TextArea
                value={jsonInput}
                onChange={e => setJsonInput(e.target.value)}
                placeholder={`Enter ${provider} format JSON here...`}
                className="font-mono text-xs resize-none min-h-[120px] max-h-[200px]"
                rows={6}
              />

              {error && (
                <Alert
                  message={error}
                  type="error"
                  showIcon
                  closable
                  onClose={() => setError(null)}
                  className="mb-0 py-1 text-xs"
                />
              )}
            </div>
          </Card>

          {/* Bottom - Output */}
          <Card
            title={<span className="text-sm">Chat View</span>}
            size="small"
            className="flex-1 flex flex-col overflow-hidden"
            styles={{
              body: {
                padding: '8px',
                overflowY: 'auto',
                flex: 1,
              },
            }}
          >
            {messages || tools ? (
              <div className="space-y-4">
                {/* Tools section first, collapsed by default */}
                {tools && tools.length > 0 && (
                  <div>
                    <Collapse
                      items={[
                        {
                          key: 'tools',
                          label: (
                            <div className="flex items-center gap-2">
                              <Wrench className="w-4 h-4" />
                              <span className="text-sm font-medium">
                                Tool Declarations
                              </span>
                            </div>
                          ),
                          extra: (
                            <Badge
                              count={tools.length}
                              style={{ backgroundColor: '#722ed1' }}
                            />
                          ),
                          children: (
                            <Card
                              className="bg-gray-50 border-0"
                              size="small"
                              styles={{ body: { padding: '8px' } }}
                            >
                              <ToolDeclarationView tools={tools} />
                            </Card>
                          ),
                        },
                      ]}
                      defaultActiveKey={[]} // Collapsed by default
                      className="bg-white border-gray-200"
                      size="small"
                    />
                  </div>
                )}

                {/* Chat messages section */}
                {messages && messages.length > 0 && (
                  <div>
                    <ChatView messages={messages} />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <MessageSquare className="w-10 h-10 mx-auto mb-2" />
                  <Text type="secondary" className="text-sm">
                    Enter JSON data and click &quot;Parse&quot; to visualize
                  </Text>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
