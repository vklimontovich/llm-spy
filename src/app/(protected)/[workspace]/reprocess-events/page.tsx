'use client'

import { Button, notification } from 'antd'
import { useMutation } from '@tanstack/react-query'
import { useWorkspaceTrpc } from '@/lib/trpc'

export default function PostProcessPage() {
  const trpc = useWorkspaceTrpc()

  const reprocessMutation = useMutation({
    mutationFn: () => trpc.reprocess.reprocessAll.mutate(),
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
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '24px',
        padding: '20px',
      }}
    >
      {!reprocessMutation.isSuccess && (
        <>
          <div
            style={{
              maxWidth: '500px',
              textAlign: 'center',
              marginBottom: '8px',
            }}
          >
            <h2>Reprocess Responses</h2>
            <p style={{ color: '#666', marginTop: '12px' }}>
              This will reprocess all responses where model parsing failed
              (missing request or response model). The system will attempt to
              extract provider, model names, usage, pricing, and preview data
              from stored request/response bodies.
            </p>
          </div>
          <Button
            type="primary"
            size="large"
            loading={reprocessMutation.isPending}
            onClick={() => reprocessMutation.mutate()}
          >
            Start Reprocessing
          </Button>
        </>
      )}

      {reprocessMutation.isSuccess && (
        <>
          <div style={{ fontSize: '48px' }}>✓</div>
          <div style={{ fontSize: '18px' }}>Complete</div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            Total: {reprocessMutation.data.total} | Success:{' '}
            {reprocessMutation.data.success} | Failed:{' '}
            {reprocessMutation.data.failed}
          </div>
        </>
      )}
    </div>
  )
}
