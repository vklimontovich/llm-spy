'use client'

import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Button } from 'antd'
import {
  Activity,
  Network,
  LogOut,
  User,
  ChevronDown,
  Key,
  MessageCircle,
} from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { useFrontendConfig } from '@/lib/frontend-config-provider'

// Navigation Item Component
const NavItem = ({
  href,
  icon: Icon,
  label,
  isActive,
}: {
  href: string
  icon: React.ElementType
  label: string
  isActive: boolean
}) => (
  <Link href={href}>
    <Button
      type={isActive ? 'primary' : 'text'}
      icon={<Icon className="w-4 h-4" />}
      className={`
        ${
          isActive
            ? 'bg-gradient-to-r from-blue-500 to-blue-600 border-0 shadow-lg shadow-blue-500/25'
            : ''
        }
      `}
    >
      {label}
    </Button>
  </Link>
)

// User Dropdown Component
const UserDropdown = ({ userEmail }: { userEmail: string }) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
        <div className="text-left">
          <div className="text-xs text-gray-500">Logged in as</div>
          <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
            {userEmail}
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-100 py-2 z-20">
            <div className="px-4 py-2 border-b border-gray-100">
              <div className="text-xs text-gray-500">Account</div>
              <div className="text-sm font-medium text-gray-900 truncate">
                {userEmail}
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-red-600 text-sm font-medium w-full transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function WorkspaceHeader({
  workspaceSlug,
  userEmail,
}: {
  workspaceSlug: string
  userEmail: string
}) {
  const pathname = usePathname()
  const config = useFrontendConfig()

  const isActive = (path: string) => {
    if (path === 'requests') {
      return pathname === `/${workspaceSlug}/requests` || pathname === '/'
    }
    if (path === 'api keys') {
      return pathname.includes(`/${workspaceSlug}/keys`)
    }
    if (path === 'feedback') {
      return pathname.includes('/feedback')
    }
    return pathname.includes(`/${workspaceSlug}/${path}`)
  }

  const navItems = [
    {
      href: `/${workspaceSlug}/requests`,
      icon: Activity,
      label: 'LLM Calls',
    },
    {
      href: `/${workspaceSlug}/upstreams`,
      icon: Network,
      label: 'Upstreams',
    },
    { href: `/${workspaceSlug}/keys`, icon: Key, label: 'API Keys' },
  ]

  if (config.feedbackEnabled) {
    navItems.push({
      href: `/${workspaceSlug}/feedback`,
      icon: MessageCircle,
      label: 'Feedback',
    })
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="w-full max-w-[1900px] mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Logo href="/" />
            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full">
              BETA
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-2">
            {navItems.map(item => (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                isActive={isActive(item.label.toLowerCase())}
              />
            ))}
          </nav>

          {/* User Menu */}
          <UserDropdown userEmail={userEmail} />
        </div>
      </div>
    </header>
  )
}
