'use client'

import { useState } from 'react'

interface ConnectionInstructionsProps {
  workspaceSlug: string
  upstreamName: string
  compact?: boolean
}

export default function ConnectionInstructions({
  workspaceSlug,
  upstreamName,
  compact = false
}: ConnectionInstructionsProps) {
  const [expanded, setExpanded] = useState(!compact)
  const endpoint = typeof window !== 'undefined'
    ? `${window.location.origin}/${workspaceSlug}/${upstreamName}`
    : `https://your-domain.com/${workspaceSlug}/${upstreamName}`

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 border-b border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <h2 className="text-lg font-semibold text-gray-900">
          Connection Details
        </h2>
      </button>

      {expanded && (
        <div className="p-6">
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              Direct your LLM requests to{' '}
              <code className="px-2 py-0.5 bg-gray-100 rounded text-gray-800">
                {endpoint}
              </code>
            </p>

            <p className="text-sm text-gray-700">
              Add <code className="px-2 py-0.5 bg-gray-100 rounded text-gray-800">x-api-key</code> header for authentication.{' '}
              <a
                href={`/${workspaceSlug}/keys`}
                className="text-blue-600 hover:text-blue-700"
              >
                Manage keys here
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}