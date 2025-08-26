'use client'

import { Typography, Dropdown, Button } from 'antd'
import { EyeOutlined, UserOutlined, LogoutOutlined } from '@ant-design/icons'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'

const { Title } = Typography

export default function Header() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const isActive = (path: string) => {
    if (path === '/requests') {
      return pathname === '/requests' || pathname === '/'
    }
    return pathname === path
  }

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/' })
  }

  const menuItems = [
    {
      key: 'logout',
      label: 'Logout',
      icon: <LogoutOutlined />,
      onClick: handleLogout,
    },
  ]

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white px-6 border-b border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Title level={3} className="!m-0 !text-blue-600">
            <EyeOutlined className="mr-2" />
            HTTP Capture
          </Title>
          
          <nav className="flex gap-2">
            <Link href="/requests">
              <Button 
                type={isActive('/requests') ? 'primary' : 'text'}
                className={isActive('/requests') ? 'border-b-2 border-blue-600' : ''}
              >
                Requests
              </Button>
            </Link>
            <Link href="/upstreams">
              <Button 
                type={isActive('/upstreams') ? 'primary' : 'text'}
                className={isActive('/upstreams') ? 'border-b-2 border-blue-600' : ''}
              >
                Upstreams
              </Button>
            </Link>
          </nav>
        </div>
        
        {session?.user && (
          <Dropdown menu={{ items: menuItems }} placement="bottomRight">
            <Button 
              type="text" 
              icon={<UserOutlined />}
              className="flex items-center gap-2"
            >
              <span className="text-sm">{session.user.email}</span>
            </Button>
          </Dropdown>
        )}
      </div>
    </header>
  )
}