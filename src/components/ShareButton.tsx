'use client'

import { Button, notification } from 'antd'
import { Lock, Unlock } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { useWorkspaceTrpc } from '@/lib/trpc'

interface ShareButtonProps {
  requestId: string
}

export default function ShareButton({ requestId }: ShareButtonProps) {
  const searchParams = useSearchParams()
  const [copyText, setCopyText] = useState('Copy Public Link')
  const queryClient = useQueryClient()
  const trpc = useWorkspaceTrpc()

  // Fetch the current share status
  const { data: shareStatus, isLoading } = useQuery({
    queryKey: ['share-status', requestId],
    queryFn: () => trpc.requests.getStatus.query({ id: requestId }),
    refetchInterval: false,
    staleTime: 30000, // Consider data stale after 30 seconds
  })

  const isShared = shareStatus?.public || false

  // Reset copy text when request changes
  useEffect(() => {
    setCopyText('Copy Public Link')
  }, [requestId])

  const toggleShareMutation = useMutation({
    mutationFn: (makePublic: boolean) =>
      trpc.requests.setPublic.mutate({ id: requestId, public: makePublic }),
    onSuccess: () => {
      // Invalidate both the share status and the requests list
      queryClient.invalidateQueries({ queryKey: ['share-status', requestId] })
      queryClient.invalidateQueries({ queryKey: ['requests'] })
    },
    onError: (error: Error) => {
      console.error('Failed to toggle share status:', error)
      notification.error({
        message: 'Failed to update sharing settings',
        description:
          error.message || 'An error occurred while updating sharing settings',
      })
    },
  })

  const copyShareLink = () => {
    const tab = searchParams.get('tab') || 'chat'
    const shareUrl = `${window.location.origin}/share?id=${requestId}&tab=${tab}`
    navigator.clipboard.writeText(shareUrl)
    setCopyText('Copied!')
    setTimeout(() => setCopyText('Copy Public Link'), 2000)
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button size="large" disabled icon={<Lock className="w-4 h-4" />}>
          Sharing Settings
        </Button>
        <div className="h-5" /> {/* Placeholder to prevent layout shift */}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type={isShared ? 'default' : 'primary'}
        size="large"
        icon={
          isShared ? (
            <Lock className="w-4 h-4" />
          ) : (
            <Unlock className="w-4 h-4" />
          )
        }
        onClick={() => toggleShareMutation.mutate(!isShared)}
        loading={toggleShareMutation.isPending}
      >
        {isShared ? 'Make Private' : 'Make Public'}
      </Button>
      <a
        href="#"
        onClick={e => {
          e.preventDefault()
          copyShareLink()
        }}
        className={`text-sm text-blue-600 hover:text-blue-800 decoration-dashed ${isShared ? 'visible' : 'invisible'}`}
      >
        {copyText}
      </a>
    </div>
  )
}
