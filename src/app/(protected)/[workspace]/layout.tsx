'use client'

import AuthGuard from '@/components/AuthGuard'
import Logo from '@/components/Logo'
import { usePathname, useParams } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { Button } from 'antd'
import { Activity, Network, LogOut, User, ChevronDown, Key } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'

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
const UserDropdown = ({ session }: { session: any }) => {
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
            {session?.user?.email}
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
                {session?.user?.email}
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

export default function ProtectedAuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const pathname = usePathname()
  const params = useParams()
  const { data: session } = useSession()

  const isActive = (path: string) => {
    if (path === 'requests') {
      return pathname === `/${params.workspace}/requests` || pathname === '/'
    }
    if (path === 'api keys') {
      return pathname.includes(`/${params.workspace}/keys`)
    }
    return pathname.includes(`/${params.workspace}/${path}`)
  }

  const navItems = [
    {
      href: `/${params.workspace}/requests`,
      icon: Activity,
      label: 'LLM Calls',
    },
    {
      href: `/${params.workspace}/upstreams`,
      icon: Network,
      label: 'Upstreams',
    },
    { href: `/${params.workspace}/keys`, icon: Key, label: 'API Keys' },
  ]

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
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
              {session && <UserDropdown session={session} />}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="w-full min-w-[1024px]">
          <div className="max-w-[1900px] mx-auto">{children}</div>
        </main>
      </div>
    </AuthGuard>
  )
}
