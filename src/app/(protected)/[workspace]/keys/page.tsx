'use client'

import { KeyList } from '@/components/KeyList'
import GettingStarted from '@/components/GettingStarted'

export default function KeysPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <KeyList />

      <GettingStarted header="How to Connect" />
    </div>
  )
}
