'use client'

import { Skeleton } from 'antd'

export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header skeleton */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="w-full max-w-[1900px] mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo skeleton */}
            <div className="flex items-center gap-3">
              <Skeleton.Button active size="small" shape="square" />
              <Skeleton.Button active size="small" />
            </div>
            
            {/* Navigation skeleton */}
            <div className="flex items-center gap-2">
              <Skeleton.Button active />
              <Skeleton.Button active />
            </div>
            
            {/* User menu skeleton */}
            <Skeleton.Avatar active size="default" />
          </div>
        </div>
      </header>
      
      {/* Main content skeleton */}
      <main className="w-full min-w-[1024px]">
        <div className="max-w-[1900px] mx-auto p-6">
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      </main>
    </div>
  )
}