'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  Button,
  Table,
  Modal,
  message,
  Typography,
  Alert,
  Space,
  Tag,
} from 'antd'
import { Plus, Trash2, Copy } from 'lucide-react'
import { useWorkspaceApi } from '@/lib/api'
import KeyDisplay from './KeyDisplay'
import { KeyModel } from '@/lib/model/keys'

const { Text, Title, Paragraph } = Typography

interface AuthKey extends KeyModel {
  createdAt?: string
}

export function KeyList() {
  const params = useParams()
  const workspace = params.workspace as string
  const api = useWorkspaceApi()
  const [keys, setKeys] = useState<AuthKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    fetchKeys()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace])

  const fetchKeys = async () => {
    try {
      const { data } = await api.get(`/workspaces/${workspace}/keys`)
      setKeys(data)
    } catch (error: any) {
      console.error('Error fetching keys:', error)
      message.error(error.response?.data?.error || 'Failed to fetch API keys')
    } finally {
      setLoading(false)
    }
  }

  const createKey = async () => {
    setCreating(true)
    try {
      const { data } = await api.post(`/workspaces/${workspace}/keys`, {})
      setNewKey(data.key)
      await fetchKeys()
      message.success('API key created successfully')
    } catch (error: any) {
      console.error('Error creating key:', error)
      message.error(error.response?.data?.error || 'Failed to create API key')
    } finally {
      setCreating(false)
    }
  }

  const deleteKey = async (keyId: string) => {
    Modal.confirm({
      title: 'Delete API Key',
      content:
        'Are you sure you want to delete this API key? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await api.delete(`/workspaces/${workspace}/keys/${keyId}`)
          await fetchKeys()
          message.success('API key deleted successfully')
        } catch (error: any) {
          console.error('Error deleting key:', error)
          message.error(
            error.response?.data?.error || 'Failed to delete API key'
          )
        }
      },
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    message.success('Copied to clipboard', 2)
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
      render: (hint: string, record: AuthKey) => (
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
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      align: 'right' as const,
      render: (_: any, record: AuthKey) => (
        <Button
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
                  loading={creating}
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
                  icon={<Copy className="w-4 h-4" />}
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
