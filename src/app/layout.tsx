import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { RootProviders } from '@/lib/providers'
import { copy, DOMAIN } from '@/lib/copy'
import { FrontendAppConfigProvider } from '@/lib/frontend-config-provider'
import { getOrigin } from '@/lib/route-helpers'
import { serverEnv } from '@/lib/server-env'

// Force all routes to be dynamic since we use headers() extensively
export const dynamic = 'force-dynamic'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: `${copy.brand.name} - ${copy.hero.title}`,
  description: copy.hero.subtitle,
  keywords:
    'LLM monitoring, AI agent debugging, prompt tracking, Claude monitoring, GPT monitoring, AI observability, LLM proxy, AI transparency, token usage tracking, LLM gateway',
  authors: [{ name: copy.brand.name }],
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', type: 'image/x-icon' },
    ],
    shortcut: '/favicon.ico',
    apple: '/favicon.svg',
  },
  openGraph: {
    title: `${copy.brand.name} - ${copy.hero.title}`,
    description: copy.hero.subtitle,
    url: `https://${DOMAIN}`,
    siteName: copy.brand.name,
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${copy.brand.name} - ${copy.hero.title}`,
    description: copy.hero.subtitle,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const origin = await getOrigin()
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico" type="image/x-icon" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-y-scroll`}
      >
        <FrontendAppConfigProvider
          config={{
            origin: origin,
            apiOrigin: serverEnv.API_ORIGIN || origin,
            isSecure: origin.startsWith('https://'),
            feedbackEnabled: serverEnv.FEEDBACK_ENABLED,
          }}
        >
          <RootProviders>{children}</RootProviders>
        </FrontendAppConfigProvider>
      </body>
    </html>
  )
}
