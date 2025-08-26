'use client'

import { Drawer } from 'antd'
import ShareButton from './ShareButton'
import RequestView from './RequestView'
import { RequestResponse } from '@/app/(protected)/requests/page'

interface RequestDetailsProps {
  selectedRequest: RequestResponse | null
  onClose: () => void
  showShare?: boolean
}

export default function RequestDetails({
  selectedRequest,
  onClose,
  showShare = false
}: RequestDetailsProps) {
  const title = (
    <div className="flex items-center justify-between">
      <span>Request/Response Details</span>
      {showShare && selectedRequest && (
        <ShareButton 
          requestId={selectedRequest.id} 
        />
      )}
    </div>
  )

  return (
    <Drawer
      title={title}
      placement="right"
      width="90%"
      open={selectedRequest !== null}
      onClose={onClose}
    >
      {selectedRequest && (
        <RequestView selectedRequest={selectedRequest} />
      )}
    </Drawer>
  )
}