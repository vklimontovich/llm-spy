'use client'

import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from 'antd'
import GettingStarted from './GettingStarted'
import {
  Activity,
  Edit3,
  Hash,
  Link2,
  MoreVertical,
  Server,
  Trash2,
} from 'lucide-react'
import { useWorkspaceApi } from '@/lib/api'

interface Upstream {
  id: string
  name: string
  url: string
  headers: any
  inputFormat?: string
  createdAt: string
  updatedAt: string
}

interface UpstreamListProps {
  upstreams: Upstream[]
  isLoading: boolean
}

// Loading Skeleton Component
const UpstreamSkeleton = () => (
  <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-200 rounded-lg" />
        <div>
          <div className="h-5 bg-gray-200 rounded w-32 mb-2" />
          <div className="h-3 bg-gray-100 rounded w-48" />
        </div>
      </div>
    </div>
    <div className="space-y-3 mb-4">
      <div className="h-3 bg-gray-100 rounded w-full" />
      <div className="h-3 bg-gray-100 rounded w-3/4" />
    </div>
    <div className="flex gap-2">
      <div className="h-8 bg-gray-100 rounded-lg w-20" />
      <div className="h-8 bg-gray-100 rounded-lg w-20" />
      <div className="h-8 bg-gray-100 rounded-lg w-20" />
    </div>
  </div>
)

// Action Menu Component
const ActionMenu = ({
  onEdit,
  onDelete,
}: {
  onEdit: () => void
  onDelete: () => void
}) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <MoreVertical className="w-4 h-4 text-gray-500" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-20">
            <button
              onClick={() => {
                onEdit()
                setIsOpen(false)
              }}
              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-gray-700 text-sm w-full transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              Edit Configuration
            </button>
            <button
              onClick={() => {
                onDelete()
                setIsOpen(false)
              }}
              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-red-600 text-sm w-full transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Upstream
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// Upstream Card Component
const UpstreamCard = ({
  upstream,
  onDelete,
  isDeleting,
}: {
  upstream: Upstream
  onDelete: () => void
  isDeleting: boolean
}) => {
  const router = useRouter()
  const params = useParams()
  const workspaceSlug = params.workspace as string

  const headerCount = upstream.headers
    ? Array.isArray(upstream.headers)
      ? upstream.headers.length
      : Object.keys(upstream.headers).length
    : 0

  return (
    <div
      className={`
      bg-white rounded-xl border border-gray-200 p-6
      hover:shadow-lg hover:border-blue-200 transition-all duration-200
      ${isDeleting ? 'opacity-50 pointer-events-none' : ''}
    `}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
            <Server className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{upstream.name}</h3>
            <div className="flex items-center gap-4 mt-1">
              {upstream.url ? (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Link2 className="w-3 h-3" />
                  <span className="truncate max-w-[200px]">{upstream.url}</span>
                </div>
              ) : (
                <span className="text-xs text-gray-400">No URL configured</span>
              )}
              {headerCount > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Hash className="w-3 h-3" />
                  <span>{headerCount} headers</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <ActionMenu
          onEdit={() =>
            router.push(`/${workspaceSlug}/upstreams/${upstream.id}`)
          }
          onDelete={onDelete}
        />
      </div>

      <div className="flex items-end justify-between">
        <div className="flex gap-2">
          <Button
            type="primary"
            ghost
            onClick={() =>
              router.push(`/${workspaceSlug}/upstreams/${upstream.id}`)
            }
            icon={<Edit3 className="w-3.5 h-3.5" />}
          >
            Edit
          </Button>
          <Button
            onClick={() =>
              router.push(
                `/${workspaceSlug}/requests?upstream=${upstream.name}`
              )
            }
            icon={<Activity className="w-3.5 h-3.5" />}
          >
            View Requests
          </Button>
        </div>

        <div className="flex items-end gap-1.5 text-xs text-gray-400">
          {upstream.inputFormat && (
            <span className=" px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              {upstream.inputFormat.toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// Empty State Component
const EmptyState = () => (
  <div className="py-6">
    <div className="mb-4 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
        <Server className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900">
        No upstreams configured
      </h3>
    </div>
    <div className="max-w-2xl mx-auto w-full">
      <GettingStarted />
    </div>
  </div>
)

// Main Component
export default function UpstreamList({
  upstreams,
  isLoading,
}: UpstreamListProps) {
  const queryClient = useQueryClient()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const api = useWorkspaceApi()

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/upstreams/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upstreams'] })
      setDeletingId(null)
    },
    onError: (error: Error) => {
      console.error('Failed to delete upstream:', error)
      setDeletingId(null)
    },
  })

  const handleDelete = (upstream: Upstream) => {
    if (
      confirm(
        `Are you sure you want to delete "${upstream.name}"?\n\nThis action cannot be undone.`
      )
    ) {
      setDeletingId(upstream.id)
      deleteMutation.mutate(upstream.id)
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <UpstreamSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (!upstreams || upstreams.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
      {upstreams.map(upstream => (
        <UpstreamCard
          key={upstream.id}
          upstream={upstream}
          onDelete={() => handleDelete(upstream)}
          isDeleting={deletingId === upstream.id}
        />
      ))}
    </div>
  )
}
