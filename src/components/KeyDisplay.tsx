'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Button, message, notification, Tooltip } from 'antd'
import { Eye, EyeOff } from 'lucide-react'
import { useWorkspaceTrpc } from '@/lib/trpc'

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
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const params = useParams()
  const workspaceSlug = params?.workspace as string | undefined
  const trpc = useWorkspaceTrpc()

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

    try {
      const response = await trpc.keys.reveal.mutate({
        workspaceIdOrSlug: workspaceSlug,
        keyId,
      })
      setRevealedKey(response.key)
      setRevealed(true)
    } catch (error: any) {
      console.error('Error revealing key:', error)
      notification.error({
        message: 'Failed to reveal key',
        description: error.message || 'An error occurred while revealing key',
      })
    }
  }

  if (mode === 'embed') {
    return (
      <Tooltip title={revealed ? 'Click to hide key' : 'Click to reveal key'}>
        <code
          onClick={handleReveal}
          className="cursor-pointer transition-opacity opacity-100"
          style={{ cursor: 'pointer' }}
        >
          {revealed && revealedKey ? revealedKey : hint}
        </code>
      </Tooltip>
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
          revealed ? (
            <EyeOff className="w-3 h-3" />
          ) : (
            <Eye className="w-3 h-3" />
          )
        }
        onClick={handleReveal}
      />
    </div>
  )
}
