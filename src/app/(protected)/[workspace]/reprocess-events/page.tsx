'use client'

import { Button, InputNumber, notification } from 'antd'
import { useMutation } from '@tanstack/react-query'
import { useWorkspaceTrpc } from '@/lib/trpc'
import { useState } from 'react'

export default function PostProcessPage() {
  const trpc = useWorkspaceTrpc()
  const [limit, setLimit] = useState(100)

  const reprocessMutation = useMutation({
    mutationFn: () => trpc.reprocess.reprocessAll.mutate({ limit }),
    onError: (error: Error) => {
      console.error('Reprocessing failed:', error)
      notification.error({
        message: 'Reprocessing failed',
        description: error.message || 'An error occurred',
      })
    },
  })

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '24px',
        padding: '40px 20px',
      }}
    >
      {reprocessMutation.isSuccess && (
        <div
          style={{
            maxWidth: '500px',
            margin: '0 auto',
            padding: '16px',
            backgroundColor: '#f6ffed',
            border: '1px solid #b7eb8f',
            borderRadius: '8px',
          }}
        >
          <div
            style={{
              fontSize: '16px',
              fontWeight: 'bold',
              marginBottom: '8px',
            }}
          >
            ✓ Reprocessing Complete
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            Total: {reprocessMutation.data.total} | Success:{' '}
            {reprocessMutation.data.success} | Failed:{' '}
            {reprocessMutation.data.failed}
          </div>
        </div>
      )}

      <div
        style={{
          maxWidth: '500px',
          margin: '0 auto',
          textAlign: 'center',
        }}
      >
        <h2>Reprocess Responses</h2>
        <p style={{ color: '#666', marginTop: '12px' }}>
          This will reprocess all responses where model parsing failed (missing
          request or response model). The system will attempt to extract
          provider, model names, usage, pricing, and preview data from stored
          request/response bodies.
        </p>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          justifyContent: 'center',
        }}
      >
        <label htmlFor="limit">Number of requests to process:</label>
        <InputNumber
          id="limit"
          min={1}
          max={10000}
          value={limit}
          onChange={value => setLimit(value || 100)}
          disabled={reprocessMutation.isPending}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Button
          type="primary"
          size="large"
          loading={reprocessMutation.isPending}
          onClick={() => reprocessMutation.mutate()}
        >
          Start Reprocessing
        </Button>
      </div>
    </div>
  )
}
