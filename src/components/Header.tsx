'use client'

import { Typography } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import { useRouter, usePathname } from 'next/navigation'

const { Title } = Typography

export default function Header() {
  const router = useRouter()
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/requests') {
      return pathname === '/requests' || pathname === '/'
    }
    return pathname === path
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white px-6 border-b border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Title level={3} className="!m-0 !text-blue-600">
            <EyeOutlined className="mr-2" />
            HTTP Capture
          </Title>
          
          <nav className="flex gap-6">
            <button
              onClick={() => router.push('/requests')}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                isActive('/requests')
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Requests
            </button>
            <button
              onClick={() => router.push('/upstreams')}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                isActive('/upstreams')
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Upstreams
            </button>
          </nav>
        </div>
      </div>
    </header>
  )
}