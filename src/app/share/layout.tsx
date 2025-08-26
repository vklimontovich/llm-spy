'use client'

import { Button } from 'antd'
import Logo from '@/components/Logo'
import Link from 'next/link'

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40">
        <div className="w-full max-w-[1900px] mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Logo href="/" />
              <span className="px-2 py-0.5 bg-green-50 text-green-600 text-xs font-semibold rounded-full">
                SHARED VIEW
              </span>
            </div>
            <Link href="/">
              <Button type="primary">
                Login or Signup
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full min-w-[1024px]">
        <div className="max-w-[1900px] mx-auto p-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-4">
        <div className="max-w-[1900px] mx-auto px-6 text-center">
          <p className="text-sm text-gray-500">
            This is a shared view. Some features may be limited.
          </p>
        </div>
      </footer>
    </div>
  )
}