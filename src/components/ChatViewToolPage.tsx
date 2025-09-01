'use client'

import { useState, useEffect, startTransition } from 'react'
import { Card, Input, Select, Button, Alert, Collapse, Badge } from 'antd'
import { FileJson, MessageSquare, Wrench } from 'lucide-react'
import ChatView from '@/components/ChatView'
import ToolDeclarationView from '@/components/ToolDeclarationView'
import { getParserForProvider } from '@/lib/format'
import type { ModelMessage, Tool } from 'ai'
import { useRouter } from 'next/navigation'

const { TextArea } = Input

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
  const [isParsing, setIsParsing] = useState(false)

  // Update provider when defaultProvider changes
  useEffect(() => {
    if (defaultProvider && providers.some(p => p.value === defaultProvider)) {
      setProvider(defaultProvider)
    }
  }, [defaultProvider])

  const handleParse = async () => {
    setError(null)
    setMessages(null)
    setTools(null)
    setIsParsing(true)

    if (!jsonInput.trim()) {
      setError('Please enter JSON data')
      setIsParsing(false)
      return
    }

    // Use setTimeout to allow UI to update before heavy processing
    await new Promise(resolve => setTimeout(resolve, 10))

    try {
      const parsed = JSON.parse(jsonInput)

      // Another brief pause for UI update
      await new Promise(resolve => setTimeout(resolve, 10))

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
        setIsParsing(false)
        return
      }

      // Use the parser's createConversation method to convert provider format to model messages
      try {
        // Use startTransition for non-urgent updates
        startTransition(() => {
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
          setIsParsing(false)
        })
      } catch (parseError) {
        console.error('Error in createConversation:', parseError)
        setError(
          `Parser error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        )
        setIsParsing(false)
      }
    } catch (e) {
      console.error('JSON parsing error:', e)
      setError(
        `Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`
      )
      setIsParsing(false)
    }
  }

  const handleExampleLoad = () => {
    // Load an example based on selected provider
    const examples: Record<string, any> = {
      anthropic: {
        model: 'claude-3-opus-20240229',
        system: 'You are geography expert.',
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
          <h1 className="text-lg font-semibold mb-0">Chat View Tool</h1>
          <span className="text-sm text-gray-500">
            Parse and visualize LLM conversations
          </span>
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
                  <span className="mr-1 text-xs">Provider:</span>
                  <Select
                    value={provider}
                    onChange={handleProviderChange}
                    options={providers}
                    size="small"
                    className="w-28"
                  />
                  <Button
                    type="link"
                    onClick={handleExampleLoad}
                    icon={<FileJson className="w-3 h-3" />}
                    className="text-xs"
                  >
                    Example
                  </Button>
                  <Button
                    type="primary"
                    onClick={handleParse}
                    loading={isParsing}
                    disabled={isParsing}
                  >
                    Process
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
            title={
              <div className="flex items-center justify-between">
                <span className="text-sm">Chat View</span>
                {messages && messages.length > 0 && (
                  <div className="text-xs text-gray-500 font-normal">
                    {messages.length} message{messages.length !== 1 ? 's' : ''},{' '}
                    {Math.round(
                      new TextEncoder().encode(jsonInput).length / 1024
                    )}{' '}
                    kb
                  </div>
                )}
              </div>
            }
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
            {isParsing ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="relative w-12 h-12">
                  <div className="absolute top-0 left-0 w-full h-full border-4 border-gray-200 rounded-full"></div>
                  <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <span className="mt-4 text-sm text-gray-600">Processing</span>
              </div>
            ) : messages || tools ? (
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
                  <span className="text-sm text-gray-500">
                    Enter JSON data and click &quot;Parse&quot; to visualize
                  </span>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
