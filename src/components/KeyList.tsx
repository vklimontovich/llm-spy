'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Table,
  Modal,
  message,
  notification,
  Typography,
  Alert,
  Space,
  Tag,
  App,
} from 'antd'
import { Plus, Trash2, Copy, Check } from 'lucide-react'
import KeyDisplay from './KeyDisplay'
import type { Key } from '@/schemas/keys'
import { useWorkspaceTrpc } from '@/lib/trpc'

const { Text, Title, Paragraph } = Typography

export function KeyList() {
  const params = useParams()
  const workspace = params.workspace as string
  const [newKey, setNewKey] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const trpc = useWorkspaceTrpc()
  const queryClient = useQueryClient()
  const { modal } = App.useApp()

  const { data: keys = [], isLoading: loading } = useQuery({
    queryKey: ['keys', workspace],
    queryFn: () => trpc.keys.list.query({ workspaceIdOrSlug: workspace }),
  })

  const createMutation = useMutation({
    mutationFn: () => trpc.keys.create.mutate({ workspaceIdOrSlug: workspace }),
    onSuccess: data => {
      setNewKey(data.key)
      message.success('API key created successfully')
      queryClient.invalidateQueries({ queryKey: ['keys', workspace] })
    },
    onError: (error: Error) => {
      console.error('Error creating key:', error)
      notification.error({
        message: 'Failed to create API key',
        description:
          error.message || 'An error occurred while creating API key',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (keyId: string) =>
      trpc.keys.delete.mutate({ workspaceIdOrSlug: workspace, keyId }),
    onSuccess: () => {
      message.success('API key deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['keys', workspace] })
    },
    onError: (error: Error) => {
      console.error('Error deleting key:', error)
      notification.error({
        message: 'Failed to delete API key',
        description:
          error.message || 'An error occurred while deleting API key',
      })
    },
  })

  const createKey = () => {
    createMutation.mutate()
  }

  const deleteKey = (keyId: string) => {
    modal.confirm({
      title: 'Delete API Key',
      content:
        'Are you sure you want to delete this API key? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: () => {
        deleteMutation.mutate(keyId)
      },
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    message.success('Copied to clipboard', 2)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 250,
      render: (id: string) => (
        <Text code className="text-xs whitespace-nowrap">
          {id}
        </Text>
      ),
    },
    {
      title: 'Key',
      dataIndex: 'hint',
      key: 'hint',
      render: (hint: string, record: Key) => (
        <KeyDisplay hint={hint} keyId={record.id} mode="rich" />
      ),
    },
    {
      title: 'Type',
      dataIndex: 'hashed',
      key: 'hashed',
      width: 100,
      render: (hashed: boolean) => (
        <Tag color={hashed ? 'green' : 'blue'}>
          {hashed ? 'Hashed' : 'Plain'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      align: 'right' as const,
      render: (_: any, record: Key) => (
        <Button
          type="text"
          size="small"
          danger
          icon={<Trash2 className="w-4 h-4" />}
          onClick={() => deleteKey(record.id)}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Title level={2}>API Keys</Title>
          <Paragraph className="text-gray-500">
            Manage API keys for authenticating requests to this workspace
          </Paragraph>
        </div>

        <Button
          type="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setModalOpen(true)}
        >
          Create API Key
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={keys}
        rowKey="id"
        loading={loading}
        pagination={false}
        locale={{
          emptyText:
            'No API keys yet. Create your first API key to get started.',
        }}
      />

      <Modal
        title="Create API Key"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setNewKey(null)
          setCopied(false)
        }}
        footer={
          newKey
            ? [
                <Button
                  key="done"
                  type="primary"
                  onClick={() => {
                    setModalOpen(false)
                    setNewKey(null)
                    setCopied(false)
                  }}
                >
                  Done
                </Button>,
              ]
            : [
                <Button key="cancel" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>,
                <Button
                  key="create"
                  type="primary"
                  loading={createMutation.isPending}
                  onClick={createKey}
                >
                  Create Key
                </Button>,
              ]
        }
      >
        {newKey ? (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Alert
              message="Important"
              description="Copy this key now. You won't be able to see it again."
              type="warning"
              showIcon
            />

            <div>
              <Text strong>Your new API key:</Text>
              <div className="mt-2 p-3 bg-gray-50 rounded-lg flex items-center gap-2">
                <Text code className="flex-1 text-xs break-all">
                  {newKey}
                </Text>
                <Button
                  size="small"
                  icon={
                    copied ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )
                  }
                  onClick={() => copyToClipboard(newKey)}
                  style={{ border: 'none', boxShadow: 'none' }}
                />
              </div>
            </div>
          </Space>
        ) : (
          <Paragraph>
            Create a new API key for this workspace. Make sure to copy it - you
            won&apos;t be able to see it again.
          </Paragraph>
        )}
      </Modal>
    </div>
  )
}
