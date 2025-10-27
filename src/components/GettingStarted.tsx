'use client'

/**
 * Code Snippet Formatting:
 * - Arrays of strings/React fragments for each line of code
 * - joinLines() helper function combines them with newlines
 * - This keeps code readable line-by-line while allowing inline components
 */

import {
  useMemo,
  useState,
  useEffect,
  Fragment,
  createContext,
  useContext,
} from 'react'
import { useParams } from 'next/navigation'
import { Select, Card, Typography, Alert, Spin, Tabs } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useWorkspaceTrpc } from '@/lib/trpc'
import { useFrontendConfig } from '@/lib/frontend-config-provider'
import KeyDisplay from './KeyDisplay'
import type { Key } from '@/schemas/keys'
import type { Upstream } from '@/schemas/upstreams'
import { DOMAIN } from '@/lib/copy'

const { Title, Text, Paragraph } = Typography

// Demo Mode Context
const DemoModeContext = createContext<boolean>(false)

function DemoModeProvider({ children }: { children: React.ReactNode }) {
  return (
    <DemoModeContext.Provider value={true}>{children}</DemoModeContext.Provider>
  )
}

function useIsDemoMode(): boolean {
  return useContext(DemoModeContext)
}

/**
 * Helper function to join lines with newlines
 * Accepts an array of strings or React nodes
 */
function joinLines(lines: (string | React.ReactNode)[]): React.ReactNode {
  return lines.map((line, i) => (
    <Fragment key={i}>
      {line}
      {i < lines.length - 1 && '\n'}
    </Fragment>
  ))
}

// Component-specific types extending schema types
type UpstreamForDisplay = Pick<Upstream, 'id' | 'name' | 'url' | 'inputFormat'>

type ApiKey = Key & { name?: string }

interface GettingStartedProps {
  header?: string
  keys?: ApiKey[]
  upstreams?: UpstreamForDisplay[]
  fixedUpstreamId?: string // When set, upstream selector is disabled
  isModal?: boolean // When true, renders in modal-friendly layout
  demoMode?: boolean // When true, uses static data without API calls
}

type Platform = 'claude-code' | 'codex' | 'general'

const AUTH_HEADER = 'x-proxy-auth'

// Wrapper for KeyDisplay that can work in demo mode
function KeyDisplayWrapper({
  hint,
  keyId,
  mode,
}: {
  hint?: string
  keyId: string
  mode?: 'embed' | 'rich'
}) {
  const demoMode = useIsDemoMode()

  if (demoMode) {
    // In demo mode, just display the hint without loading
    return <>{hint || 'your-api-key'}</>
  }
  // Normal mode, use KeyDisplay component
  return <KeyDisplay hint={hint || 'your-api-key'} keyId={keyId} mode={mode} />
}

function detectProvider(upstream: UpstreamForDisplay): string | null {
  // Use explicit inputFormat if available
  if (upstream.inputFormat) {
    const format = upstream.inputFormat.toLowerCase()
    if (format === 'anthropic') return 'anthropic'
    if (format === 'openai') return 'openai'
  }

  // Fall back to URL detection
  if (!upstream.url) return null
  const url = upstream.url.toLowerCase()
  if (url.includes('anthropic') || url.includes('claude')) return 'anthropic'
  if (url.includes('openai')) return 'openai'
  return 'general'
}

function NoSetupPlan({ workspaceSlug }: { workspaceSlug: string }) {
  return (
    <Card className="bg-blue-50 border-blue-200">
      <Title level={4}>Getting Started - Setup Required</Title>
      <Paragraph>
        To start using the proxy, you need to set up upstreams and API keys.
        Here{"'"}s how:
      </Paragraph>

      <div className="space-y-4">
        <div>
          <Text strong>Step 1: Create an Upstream</Text>
          <Paragraph className="mt-2">
            An upstream defines the AI provider you want to proxy to (e.g.,
            Anthropic, OpenAI).
            <br />
            <a
              href={`/${workspaceSlug}/upstreams/new`}
              className="text-blue-600 hover:underline"
            >
              Create your first upstream →
            </a>
          </Paragraph>
        </div>

        <div>
          <Text strong>Step 2: Create an API Key</Text>
          <Paragraph className="mt-2">
            API keys authenticate your requests to the proxy. You can create
            multiple keys for different use cases.
            <br />
            <a
              href={`/${workspaceSlug}/keys`}
              className="text-blue-600 hover:underline"
            >
              Create your first API key →
            </a>
          </Paragraph>
        </div>

        <div>
          <Text strong>Step 3: Configure Your Client</Text>
          <Paragraph className="mt-2">
            Once you have an upstream and key, come back here to see
            instructions for connecting your client.
          </Paragraph>
        </div>
      </div>
    </Card>
  )
}

function ClaudeCodeInstructions({
  upstream,
  apiKey,
  baseUrl,
}: {
  upstream: UpstreamForDisplay
  apiKey: ApiKey
  baseUrl: string
}) {
  const command = [
    `ANTHROPIC_BASE_URL="${baseUrl}" \\`,
    <>
      ANTHROPIC_CUSTOM_HEADERS={'"'}
      {AUTH_HEADER}: {upstream.name}:
      <KeyDisplayWrapper hint={apiKey.hint} keyId={apiKey.id} mode="embed" />
      {'"'} \
    </>,
    'claude',
  ]

  return (
    <div className="space-y-4">
      <div>
        <Text strong>Configure Claude Code Environment</Text>
        <Paragraph className="mt-2">
          Set these environment variables to route Claude Code through this
          proxy:
        </Paragraph>
      </div>

      <pre className="bg-gray-50 rounded-lg p-4 text-xs overflow-auto border border-gray-200">
        <code>{joinLines(command)}</code>
      </pre>
    </div>
  )
}

function CodexInstructions({
  upstream,
  apiKey,
  baseUrl,
}: {
  upstream: UpstreamForDisplay
  apiKey: ApiKey
  baseUrl: string
}) {
  const providerName =
    'model_' + upstream.name.toLowerCase().replace(/[^a-z0-9]/g, '_')

  const config = [
    `[model_providers.${providerName}]`,
    `name = "${upstream.name} via Proxy"`,
    `base_url = "${baseUrl}"`,
    <>
      api_key = &quot;<strong>YOUR-UPSTREAM-PROVIDER-API-KEY</strong>&quot; #
      Your actual OpenAI/Anthropic key
    </>,
    'wire_api = "responses"',
    '# Proxy authentication via query params',
    <>
      query_params = {'{ __llmspy_auth_key = '}
      {'"'}
      {upstream.name}:
      <KeyDisplayWrapper hint={apiKey.hint} keyId={apiKey.id} mode="embed" />
      {'"'}
      {' }'}
    </>,
  ]

  return (
    <div className="space-y-4">
      <div>
        <Text strong>1. Configure Codex</Text>
        <Paragraph className="mt-2">
          Add this configuration to <code>~/.codex/config.toml</code>:
        </Paragraph>
      </div>

      <pre className="bg-gray-50 rounded-lg p-4 text-xs overflow-auto border border-gray-200">
        <code>{joinLines(config)}</code>
      </pre>

      <div>
        <Text strong>2. Run Codex</Text>
        <Paragraph className="mt-2">Use the configured provider:</Paragraph>
      </div>

      <pre className="bg-gray-50 rounded-lg p-4 text-xs overflow-auto border border-gray-200">
        <code>{`codex --config model_provider="${providerName}" test`}</code>
      </pre>

      <Alert
        message="Note"
        description="Replace 'YOUR-UPSTREAM-PROVIDER-API-KEY' with your actual provider API key (e.g., OpenAI or Anthropic key). The proxy will forward requests to the upstream provider while capturing telemetry."
        type="info"
        showIcon
      />
    </div>
  )
}

function GeneralInstructions({
  upstream,
  apiKey,
  baseUrl,
}: {
  upstream: UpstreamForDisplay
  apiKey: ApiKey
  baseUrl: string
}) {
  const provider = detectProvider(upstream)

  // OpenAI Responses API examples
  const openaiCurlExample = [
    `curl -X POST "${baseUrl}/v1/responses" \\`,
    '  -H "Content-Type: application/json" \\',
    <>
      {' '}
      -H &quot;Authorization: Bearer <strong>YOUR-OPENAI-API-KEY</strong>&quot;
      \
    </>,
    <>
      {' '}
      -H {'"'}
      {AUTH_HEADER}: {upstream.name}:
      <KeyDisplayWrapper hint={apiKey.hint} keyId={apiKey.id} mode="embed" />
      {'"'} \
    </>,
    "  -d '{",
    '    "model": "gpt-4o",',
    '    "input": "Hello, world"',
    "  }'",
  ]

  const openaiPythonExample = [
    'from openai import OpenAI',
    '',
    `client = OpenAI(`,
    <>
      {' '}
      api_key=&quot;<strong>YOUR-OPENAI-API-KEY</strong>&quot;,
    </>,
    `    base_url="${baseUrl}/v1",`,
    <>
      {' '}
      default_headers={'{'}
      {"'"}
      {AUTH_HEADER}
      {"'"}: {'"'}
      {upstream.name}:
      <KeyDisplayWrapper hint={apiKey.hint} keyId={apiKey.id} mode="embed" />
      {'"'}
      {'}'}
    </>,
    ')',
    '',
    'response = client.responses.create(',
    '    model="gpt-4o",',
    '    input="Hello, world"',
    ')',
    '',
    'print(response.output)',
  ]

  const openaiTypescriptExample = [
    'import OpenAI from "openai";',
    '',
    'const client = new OpenAI({',
    <>
      {' '}
      apiKey: &quot;<strong>YOUR-OPENAI-API-KEY</strong>&quot;,
    </>,
    `  baseURL: "${baseUrl}/v1",`,
    <>
      {' '}
      defaultHeaders: {'{'} {'"'}
      {AUTH_HEADER}
      {'"'}: {'"'}
      {upstream.name}:
      <KeyDisplayWrapper hint={apiKey.hint} keyId={apiKey.id} mode="embed" />
      {'"'} {'}'}
    </>,
    '});',
    '',
    'const response = await client.responses.create({',
    '  model: "gpt-4o",',
    '  input: "Hello, world"',
    '});',
    '',
    'console.log(response.output);',
  ]

  // Anthropic Messages API examples
  const anthropicCurlExample = [
    `curl -X POST "${baseUrl}/v1/messages" \\`,
    '  -H "Content-Type: application/json" \\',
    <>
      {' '}
      -H &quot;x-api-key: <strong>YOUR-ANTHROPIC-API-KEY</strong>&quot; \
    </>,
    '  -H "anthropic-version: 2023-06-01" \\',
    <>
      {' '}
      -H {'"'}
      {AUTH_HEADER}: {upstream.name}:
      <KeyDisplayWrapper hint={apiKey.hint} keyId={apiKey.id} mode="embed" />
      {'"'} \
    </>,
    "  -d '{",
    '    "model": "claude-3-5-sonnet-20241022",',
    '    "max_tokens": 1024,',
    '    "messages": [',
    '      {"role": "user", "content": "Hello, world"}',
    '    ]',
    "  }'",
  ]

  const anthropicPythonExample = [
    'import anthropic',
    '',
    `client = anthropic.Anthropic(`,
    <>
      {' '}
      api_key=&quot;<strong>YOUR-ANTHROPIC-API-KEY</strong>&quot;,
    </>,
    `    base_url="${baseUrl}",`,
    <>
      {' '}
      default_headers={'{'}
      {"'"}
      {AUTH_HEADER}
      {"'"}: {'"'}
      {upstream.name}:
      <KeyDisplayWrapper hint={apiKey.hint} keyId={apiKey.id} mode="embed" />
      {'"'}
      {'}'}
    </>,
    ')',
    '',
    'message = client.messages.create(',
    '    model="claude-3-5-sonnet-20241022",',
    '    max_tokens=1024,',
    '    messages=[',
    '        {"role": "user", "content": "Hello, world"}',
    '    ]',
    ')',
    '',
    'print(message.content)',
  ]

  const anthropicTypescriptExample = [
    'import Anthropic from "@anthropic-ai/sdk";',
    '',
    'const client = new Anthropic({',
    <>
      {' '}
      apiKey: &quot;<strong>YOUR-ANTHROPIC-API-KEY</strong>&quot;,
    </>,
    `  baseURL: "${baseUrl}",`,
    <>
      {' '}
      defaultHeaders: {'{'} {'"'}
      {AUTH_HEADER}
      {'"'}: {'"'}
      {upstream.name}:
      <KeyDisplayWrapper hint={apiKey.hint} keyId={apiKey.id} mode="embed" />
      {'"'} {'}'}
    </>,
    '});',
    '',
    'const message = await client.messages.create({',
    '  model: "claude-3-5-sonnet-20241022",',
    '  max_tokens: 1024,',
    '  messages: [',
    '    { role: "user", content: "Hello, world" }',
    '  ]',
    '});',
    '',
    'console.log(message.content);',
  ]

  // Select examples based on provider
  const curlExample =
    provider === 'openai' ? openaiCurlExample : anthropicCurlExample
  const pythonExample =
    provider === 'openai' ? openaiPythonExample : anthropicPythonExample
  const typescriptExample =
    provider === 'openai' ? openaiTypescriptExample : anthropicTypescriptExample

  const exampleTabs = [
    {
      key: 'curl',
      label: 'cURL',
      children: (
        <pre className="bg-gray-50 rounded-lg p-4 text-xs overflow-auto border border-gray-200">
          <code>{joinLines(curlExample)}</code>
        </pre>
      ),
    },
    {
      key: 'python',
      label: 'Python',
      children: (
        <pre className="bg-gray-50 rounded-lg p-4 text-xs overflow-auto border border-gray-200">
          <code>{joinLines(pythonExample)}</code>
        </pre>
      ),
    },
    {
      key: 'typescript',
      label: 'TypeScript',
      children: (
        <pre className="bg-gray-50 rounded-lg p-4 text-xs overflow-auto border border-gray-200">
          <code>{joinLines(typescriptExample)}</code>
        </pre>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <Text strong>HTTP API Configuration</Text>
        <Paragraph className="mt-2">
          Configure your client to use this proxy:
        </Paragraph>
      </div>

      <div>
        <Text strong>Base URL:</Text>
        <pre className="bg-gray-50 rounded-lg p-3 text-xs overflow-auto border border-gray-200 mt-2">
          <code>{baseUrl}</code>
        </pre>
      </div>

      <div>
        <Text strong>Authentication Header:</Text>
        <pre className="bg-gray-50 rounded-lg p-3 text-xs overflow-auto border border-gray-200 mt-2">
          <code>
            {AUTH_HEADER}: {upstream.name}:
            <KeyDisplayWrapper
              hint={apiKey.hint}
              keyId={apiKey.id}
              mode="embed"
            />
          </code>
        </pre>
      </div>

      <div>
        <Text strong>Code Examples:</Text>
        <Tabs items={exampleTabs} defaultActiveKey="curl" className="mt-2" />
      </div>
    </div>
  )
}

// Component for demo mode (no hooks that require workspace context)
function GettingStartedDemo({
  header,
  keys,
  upstreams,
  fixedUpstreamId,
  isModal = false,
}: Omit<GettingStartedProps, 'demoMode'>) {
  return (
    <DemoModeProvider>
      <GettingStartedContent
        header={header}
        keys={keys || []}
        upstreams={upstreams || []}
        fixedUpstreamId={fixedUpstreamId}
        isModal={isModal}
        demoMode={true}
        isLoading={false}
        workspaceSlug={undefined}
        apiOrigin={`https://${DOMAIN}`}
      />
    </DemoModeProvider>
  )
}

// Component for normal mode (with workspace context)
function GettingStartedWithWorkspace({
  header,
  keys: propKeys,
  upstreams: propUpstreams,
  fixedUpstreamId,
  isModal = false,
}: Omit<GettingStartedProps, 'demoMode'>) {
  const params = useParams()
  const workspaceSlug = params?.workspace as string | undefined
  const trpc = useWorkspaceTrpc()
  const config = useFrontendConfig()

  // Load keys if not provided
  const { data: loadedKeys, isLoading: keysLoading } = useQuery({
    queryKey: ['keys'],
    queryFn: async () => {
      if (!workspaceSlug) return []
      return trpc.keys.list.query({ workspaceIdOrSlug: workspaceSlug })
    },
    enabled: !propKeys && !!workspaceSlug,
  })

  // Load upstreams if not provided
  const { data: loadedUpstreams, isLoading: upstreamsLoading } = useQuery({
    queryKey: ['upstreams'],
    queryFn: () => trpc.upstreams.list.query(),
    enabled: !propUpstreams,
  })

  const keys: ApiKey[] = Array.isArray(propKeys)
    ? propKeys
    : Array.isArray(loadedKeys)
      ? loadedKeys
      : []
  const upstreams: UpstreamForDisplay[] = Array.isArray(propUpstreams)
    ? propUpstreams
    : Array.isArray(loadedUpstreams)
      ? (loadedUpstreams as UpstreamForDisplay[])
      : []
  const isLoading = keysLoading || upstreamsLoading

  return (
    <GettingStartedContent
      header={header}
      keys={keys}
      upstreams={upstreams}
      fixedUpstreamId={fixedUpstreamId}
      isModal={isModal}
      demoMode={false}
      isLoading={isLoading}
      workspaceSlug={workspaceSlug}
      apiOrigin={config.apiOrigin}
    />
  )
}

// Main component that routes to demo or normal mode
export default function GettingStarted(props: GettingStartedProps) {
  if (props.demoMode) {
    return <GettingStartedDemo {...props} />
  }
  return <GettingStartedWithWorkspace {...props} />
}

// Shared content component
function GettingStartedContent({
  header,
  keys,
  upstreams,
  fixedUpstreamId,
  isModal,
  demoMode,
  isLoading,
  workspaceSlug,
  apiOrigin,
}: {
  header?: string
  keys: ApiKey[]
  upstreams: UpstreamForDisplay[]
  fixedUpstreamId?: string
  isModal: boolean
  demoMode: boolean
  isLoading: boolean
  workspaceSlug?: string
  apiOrigin: string
}) {
  const [selectedUpstreamId, setSelectedUpstreamId] = useState<
    string | undefined
  >(fixedUpstreamId)
  const [selectedKeyId, setSelectedKeyId] = useState<string | undefined>()
  const [selectedPlatform, setSelectedPlatform] = useState<
    Platform | undefined
  >()

  const selectedUpstream = useMemo(() => {
    return upstreams.find(u => u.id === selectedUpstreamId)
  }, [upstreams, selectedUpstreamId])

  const provider = useMemo(() => {
    if (!selectedUpstream) return null
    return detectProvider(selectedUpstream)
  }, [selectedUpstream])

  const availablePlatforms = useMemo((): Array<{
    value: Platform
    label: string
    disabled?: boolean
  }> => {
    if (!provider) {
      return [{ value: 'general', label: 'General (HTTP API)' }]
    }

    return [
      {
        value: 'claude-code',
        label: 'Claude Code',
        disabled: provider !== 'anthropic',
      },
      {
        value: 'codex',
        label: 'OpenAI Codex',
        disabled: provider !== 'openai',
      },
      {
        value: 'general',
        label: 'General (HTTP API)',
      },
    ]
  }, [provider])

  const baseUrl = useMemo(() => {
    if (!selectedUpstream) return ''
    return apiOrigin
  }, [apiOrigin, selectedUpstream])

  const selectedKey = useMemo((): ApiKey => {
    const key = keys.find(k => k.id === selectedKeyId)
    if (key) return key
    if (keys[0]) return keys[0]
    // Fallback if no keys available
    return {
      id: 'placeholder',
      hashed: false,
      hint: 'your-api-key',
    }
  }, [keys, selectedKeyId])

  // Auto-select first upstream if available (unless fixed)
  useMemo(() => {
    if (!fixedUpstreamId && !selectedUpstreamId && upstreams.length > 0) {
      setSelectedUpstreamId(upstreams[0].id)
    }
  }, [upstreams, selectedUpstreamId, fixedUpstreamId])

  // Auto-select first key if available
  useMemo(() => {
    if (!selectedKeyId && keys.length > 0) {
      setSelectedKeyId(keys[0].id)
    }
  }, [keys, selectedKeyId])

  // Set default platform based on provider
  useEffect(() => {
    if (!provider) return

    let defaultPlatform: Platform = 'general'
    if (provider === 'anthropic') {
      defaultPlatform = 'claude-code'
    } else if (provider === 'openai') {
      defaultPlatform = 'codex'
    }

    // Only set if not already set or if current platform is disabled
    if (!selectedPlatform) {
      setSelectedPlatform(defaultPlatform)
    } else {
      const currentPlatform = availablePlatforms.find(
        p => p.value === selectedPlatform
      )
      if (currentPlatform?.disabled) {
        setSelectedPlatform(defaultPlatform)
      }
    }
  }, [provider, selectedPlatform, availablePlatforms])

  if (!workspaceSlug && !demoMode) {
    return (
      <Card>
        <Alert
          message="Workspace Required"
          description="Please navigate to a workspace to view connection instructions."
          type="warning"
          showIcon
        />
      </Card>
    )
  }

  if (isLoading && !demoMode) {
    return (
      <Card>
        <div className="flex justify-center items-center py-8">
          <Spin size="large" />
        </div>
      </Card>
    )
  }

  if ((upstreams.length === 0 || keys.length === 0) && !demoMode) {
    return <NoSetupPlan workspaceSlug={workspaceSlug || ''} />
  }

  return (
    <Card className={isModal ? '' : 'border border-gray-200'}>
      <div className="space-y-6">
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {header || 'How to Connect'}
          </Title>
          <Paragraph type="secondary" className="mt-1">
            Select an upstream, key, and platform to view connection
            instructions.
          </Paragraph>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Text strong className="block mb-2">
              Select Upstream
            </Text>
            <Select
              className="w-full"
              value={selectedUpstreamId}
              onChange={setSelectedUpstreamId}
              options={upstreams.map(u => ({
                value: u.id,
                label: u.name,
              }))}
              placeholder="Choose an upstream"
              disabled={!!fixedUpstreamId}
            />
          </div>

          <div>
            <Text strong className="block mb-2">
              Select API Key
            </Text>
            <Select
              className="w-full"
              value={selectedKeyId}
              onChange={setSelectedKeyId}
              options={keys.map(k => ({
                value: k.id,
                label: k.name || k.hint,
              }))}
              placeholder="Choose an API key"
            />
          </div>

          <div>
            <Text strong className="block mb-2">
              Select Platform
            </Text>
            <Select
              className="w-full"
              value={selectedPlatform}
              onChange={setSelectedPlatform}
              options={availablePlatforms.map(p => ({
                value: p.value,
                label: p.label,
                disabled: p.disabled,
              }))}
              placeholder="Select a platform"
            />
          </div>
        </div>

        {selectedUpstream && (
          <div className="mt-6">
            {selectedPlatform === 'claude-code' && (
              <ClaudeCodeInstructions
                upstream={selectedUpstream}
                apiKey={selectedKey}
                baseUrl={baseUrl}
              />
            )}
            {selectedPlatform === 'codex' && (
              <CodexInstructions
                upstream={selectedUpstream}
                apiKey={selectedKey}
                baseUrl={baseUrl}
              />
            )}
            {selectedPlatform === 'general' && (
              <GeneralInstructions
                upstream={selectedUpstream}
                apiKey={selectedKey}
                baseUrl={baseUrl}
              />
            )}
          </div>
        )}

        {keys.length === 0 && !demoMode && (
          <Alert
            message="No API Keys"
            description={
              <span>
                You need to create an API key first.{' '}
                <a
                  href={`/${workspaceSlug}/keys`}
                  className="text-blue-600 hover:underline"
                >
                  Create one now →
                </a>
              </span>
            }
            type="warning"
            showIcon
          />
        )}
      </div>
    </Card>
  )
}
