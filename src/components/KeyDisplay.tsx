'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Button, message } from 'antd'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useWorkspaceApi } from '@/lib/api'

interface KeyDisplayProps {
  hint: string
  keyId: string
  mode?: 'rich' | 'embed'
}

export default function KeyDisplay({
  hint,
  keyId,
  mode = 'rich',
}: KeyDisplayProps) {
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const params = useParams()
  const workspaceSlug = params?.workspace as string | undefined
  const api = useWorkspaceApi()

  const handleReveal = async () => {
    if (revealed && revealedKey) {
      // If already revealed, toggle back to hidden
      setRevealed(false)
      return
    }

    if (!workspaceSlug) {
      message.error('Workspace not found')
      return
    }

    setLoading(true)
    try {
      const response = await api.post(
        `/workspaces/${workspaceSlug}/keys/${keyId}/reveal`,
        {}
      )
      setRevealedKey(response.data.key)
      setRevealed(true)
    } catch (error: any) {
      console.error('Error revealing key:', error)
      const errorMessage = error.response?.data?.error || 'Failed to reveal key'
      message.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'embed') {
    return (
      <code
        onClick={handleReveal}
        className={[
          'cursor-pointer transition-opacity',
          loading ? 'opacity-50' : 'opacity-100',
        ].join(' ')}
        style={{ cursor: 'pointer' }}
      >
        {revealed && revealedKey ? revealedKey : hint}
      </code>
    )
  }

  // usual mode
  return (
    <div className="flex items-center gap-2">
      <code className="text-xs">
        {revealed && revealedKey ? revealedKey : hint}
      </code>
      <Button
        size="small"
        type="text"
        icon={
          loading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : revealed ? (
            <EyeOff className="w-3 h-3" />
          ) : (
            <Eye className="w-3 h-3" />
          )
        }
        onClick={handleReveal}
        disabled={loading}
      />
    </div>
  )
}
