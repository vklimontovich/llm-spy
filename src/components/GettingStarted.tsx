'use client'

import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Timeline, Typography, Button } from 'antd'

interface GettingStartedProps {
  // Note: `key` is reserved in React; using `apiKey` instead
  apiKey?: string
  upstreamSlug?: string
  header?: string
}

export default function GettingStarted({
  apiKey,
  upstreamSlug,
  header,
}: GettingStartedProps) {
  const router = useRouter()
  const params = useParams()
  const workspaceSlug = params?.workspace as string | undefined

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://your-host'

  const upstreamPart = upstreamSlug || '<UPSTREAM ID>'

  const exampleBaseUrl = useMemo(() => {
    // Prefer including workspace in the example when available
    if (workspaceSlug) return `${origin}/${workspaceSlug}/${upstreamPart}`
    return `${origin}/${upstreamPart}`
  }, [origin, upstreamPart, workspaceSlug])

  const runClaudeCmd = useMemo(() => {
    const monitorHeader = apiKey ? `x-monitor-auth: ${apiKey}` : 'x-monitor-auth: key you created'
    const anthropicKey = apiKey || 'your key'
    return `ANTHROPIC_BASE_URL="${exampleBaseUrl}" \
ANTHROPIC_CUSTOM_HEADERS="${monitorHeader}" \
ANTHROPIC_API_KEY="${anthropicKey}" \
claude`
  }, [apiKey, exampleBaseUrl])

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 text-left">
      <div className="mb-4">
        <Typography.Title level={4} style={{ margin: 0 }}>
          {header || 'Getting Started'}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginTop: 4 }}>
          Create an upstream, generate an API key, then point your Anthropic client to this proxy.
        </Typography.Paragraph>
      </div>

      <Timeline
        items={[
          {
            children: (
              <div>
                <Typography.Text strong>1. Create an upstream proxy</Typography.Text>
                <Typography.Paragraph style={{ marginTop: 6 }}>
                  We support Anthropic (and more).{' '}
                  <Button
                    type="link"
                    onClick={() =>
                      router.push(`/${workspaceSlug}/upstreams/new`)
                    }
                    style={{ padding: 0 }}
                  >
                    Create an upstream
                  </Button>
                  {' '}to get an upstream ID.
                </Typography.Paragraph>
              </div>
            ),
          },
          {
            children: (
              <div>
                <Typography.Text strong>2. Create a key</Typography.Text>
                <Typography.Paragraph style={{ marginTop: 6 }}>
                  Use an API key to authenticate requests.{' '}
                  {workspaceSlug ? (
                    <a href={`/${workspaceSlug}/keys`} className="text-blue-600">
                      Open API Keys
                    </a>
                  ) : (
                    <span>Open the API Keys page</span>
                  )}
                  {apiKey && (
                    <span className="ml-2 text-gray-500">(using provided key)</span>
                  )}
                </Typography.Paragraph>
              </div>
            ),
          },
          {
            children: (
              <div>
                <Typography.Text strong>
                  3. Run Claude with this proxy
                </Typography.Text>
                <Typography.Paragraph style={{ marginTop: 6 }}>
                  Set Anthropic to use this base URL and pass your auth header:
                </Typography.Paragraph>
                <pre className="bg-gray-50 rounded-lg p-3 text-xs overflow-auto">
                  <code>{`ANTHROPIC_BASE_URL="${exampleBaseUrl}" \
ANTHROPIC_CUSTOM_HEADERS="x-monitor-auth: \\
${apiKey || 'key you created'}" \
ANTHROPIC_API_KEY="${apiKey || 'your key'}" \
claude`}</code>
                </pre>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
