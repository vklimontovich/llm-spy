'use client'

import { signIn } from 'next-auth/react'
import Link from 'next/link'
import {
  ArrowLeft,
  Eye,
  Zap,
  Network,
  Sparkles,
  CheckCircle,
} from 'lucide-react'
import Logo from '@/components/Logo'
import { copy } from '@/lib/copy'

export default function SignInClient() {
  return (
    <div className="min-h-screen flex">
      {/* Left Side - Sign In Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-16 xl:px-24 bg-white">
        <div className="w-full max-w-sm mx-auto">
          {/* Back Link */}
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors group mb-8"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            {copy.signin.backLink}
          </Link>

          {/* Logo */}
          <div className="mb-8">
            <Logo href="/" />
          </div>

          {/* Form Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {copy.signin.title}
            </h1>
            <p className="text-gray-600">
              {copy.signin.subtitle}
            </p>
          </div>

          {/* Google Sign In Button */}
          <button
            onClick={() => signIn('google', { callbackUrl: '/app' })}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="text-gray-700 font-medium">
              {copy.signin.googleButton}
            </span>
          </button>

          {/* Terms */}
          <p className="text-xs text-gray-500 mt-6 text-center">
            {copy.signin.terms.prefix}{' '}
            <Link href="#" className="text-gray-900 underline">
              {copy.signin.terms.termsLink}
            </Link>{' '}
            {copy.signin.terms.and}{' '}
            <Link href="#" className="text-gray-900 underline">
              {copy.signin.terms.privacyLink}
            </Link>
          </p>

          {/* Alpha Badge */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
              <Sparkles className="w-3 h-3" />
              {copy.signin.alphaBadge}
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Feature Showcase */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-600 to-purple-600 p-12 xl:p-16">
        <div className="w-full max-w-lg mx-auto flex flex-col justify-center">
          {/* Main Heading */}
          <h2 className="text-4xl font-bold text-white mb-4">
            {copy.signin.rightPanel.title}
          </h2>
          <p className="text-xl text-blue-100 mb-12">
            {copy.signin.rightPanel.subtitle}
          </p>

          {/* Feature List */}
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
                <Eye className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">
                  {copy.features.visibility.shortTitle}
                </h3>
                <p className="text-blue-100 text-sm">
                  {copy.features.visibility.shortDescription}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">
                  {copy.features.setup.shortTitle}
                </h3>
                <p className="text-blue-100 text-sm">
                  {copy.features.setup.shortDescription}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
                <Network className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">
                  {copy.features.gateway.shortTitle}
                </h3>
                <p className="text-blue-100 text-sm">
                  {copy.features.gateway.shortDescription}
                </p>
              </div>
            </div>
          </div>

          {/* Testimonial or Stats */}
          <div className="mt-12 p-6 bg-white/10 backdrop-blur rounded-xl border border-white/20">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-white font-semibold">{copy.signin.rightPanel.quickSetup.title}</span>
            </div>
            <code className="block text-sm text-blue-100 font-mono">
              {copy.signin.rightPanel.quickSetup.code}
            </code>
            <p className="text-xs text-blue-200 mt-2">
              {copy.signin.rightPanel.quickSetup.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}