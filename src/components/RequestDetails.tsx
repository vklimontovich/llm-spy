'use client'

import { Drawer } from 'antd'
import ShareButton from './ShareButton'
import RequestResponseTabs from './RequestResponseTabs'
import { RequestResponse } from '@/app/(protected)/requests/page'

interface RequestDetailsProps {
  selectedRequest: RequestResponse | null
  activeTab: string
  onTabChange: (tab: string) => void
  onClose: () => void
  showShare?: boolean
}

export default function RequestDetails({
  selectedRequest,
  activeTab,
  onTabChange,
  onClose,
  showShare = false
}: RequestDetailsProps) {
  const title = (
    <div className="flex items-center justify-between">
      <span>Request/Response Details</span>
      {showShare && selectedRequest && (
        <ShareButton 
          requestId={selectedRequest.id} 
          activeTab={activeTab}
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
        <RequestResponseTabs
          selectedRequest={selectedRequest}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
      )}
    </Drawer>
  )
}