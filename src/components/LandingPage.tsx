'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Eye,
  Zap,
  Network,
  Terminal,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  Activity,
  Layers,
  ArrowDown,
  GitBranch,
  Share2,
} from 'lucide-react'
import Logo from './Logo'
import TerminalWindow from './TerminalWindow'
import BrowserScreenshot from './BrowserScreenshot'
import { copy, DOMAIN } from '@/lib/copy'

interface LandingPageProps {
  loggedIn?: boolean
}

// Section Component
const Section = ({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode
  className?: string
  id?: string
}) => (
  <section id={id} className={`py-24 px-4 sm:px-6 lg:px-8 ${className}`}>
    <div className="max-w-7xl mx-auto">{children}</div>
  </section>
)

// Feature Card Component
const FeatureCard = ({
  icon: Icon,
  title,
  description,
  features,
}: {
  icon: React.ElementType
  title: string
  description: string
  features: string[]
}) => (
  <div className="bg-white rounded-2xl p-8 border border-gray-100 hover:border-purple-200 hover:shadow-xl transition-all duration-200">
    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mb-6">
      <Icon className="w-6 h-6 text-white" />
    </div>
    <h3 className="text-xl font-semibold mb-3">{title}</h3>
    <p className="text-gray-600 mb-4">{description}</p>
    <ul className="space-y-2">
      {features.map((feature, idx) => (
        <li key={idx} className="flex items-center gap-2 text-sm text-gray-700">
          <ChevronRight className="w-4 h-4 text-purple-500" />
          {feature}
        </li>
      ))}
    </ul>
  </div>
)

// How It Works Step Component
const HowItWorksStep = ({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) => (
  <div className="group">
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="flex-1">
        <h3 className="text-xl font-semibold mb-2 text-gray-900 group-hover:text-purple-600 transition-colors">
          {title}
        </h3>
        <p className="text-gray-600 leading-relaxed">{description}</p>
      </div>
    </div>
  </div>
)

// Navigation Component
const Navigation = ({ loggedIn }: { loggedIn: boolean }) => (
  <nav className="sticky top-0 z-50 backdrop-blur-lg bg-white/70 border-b border-gray-100">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center h-16">
        <Logo href="/" />
        <div className="flex items-center gap-6">
          {loggedIn ? (
            <Link
              href="/app"
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-200 font-medium"
            >
              {copy.common.openApp}
            </Link>
          ) : (
            <>
              <Link
                href="/app"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                {copy.common.signIn}
              </Link>
              <Link
                href="/app"
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-200 font-medium"
              >
                {copy.common.getStarted}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  </nav>
)

// Arrow Divider Component
const ArrowDivider = () => (
  <div className="flex justify-center py-8">
    <div className="flex flex-col items-center">
      <ArrowDown className="w-8 h-8 text-purple-500 animate-bounce" />
      <span className="text-sm text-gray-500 mt-2">See the results</span>
    </div>
  </div>
)

// Session Intelligence Components
const SessionVisualization = () => (
  <div className="bg-gray-900 rounded-2xl p-6">
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        <span className="text-xs text-gray-400 font-mono">Session #A7B2</span>
      </div>

      <div className="space-y-2">
        <SessionMessage
          type="request"
          number={1}
          time="14:23:01"
          content="Create a Python function to parse JSON"
        />
        <SessionMessage
          type="response"
          number={1}
          time="14:23:02"
          content="def parse_json(data): ..."
        />
        <SessionMessage
          type="request"
          number={2}
          time="14:23:15"
          content="Add error handling to that function"
        />
        <SessionMessage
          type="response"
          number={2}
          time="14:23:16"
          content="try: ... except JSONDecodeError: ..."
        />
      </div>

      <div className="mt-4 text-xs text-gray-400 text-center">
        Automatically grouped into one session
      </div>
    </div>
  </div>
)

const SessionMessage = ({
  type,
  number,
  time,
  content,
}: {
  type: 'request' | 'response'
  number: number
  time: string
  content: string
}) => {
  const isRequest = type === 'request'
  return (
    <div
      className={`bg-gray-800 rounded-lg p-3 border-l-2 ${isRequest ? 'border-blue-500' : 'border-green-500'}`}
    >
      <p className="text-xs text-gray-500 mb-1">
        {isRequest ? 'Request' : 'Response'} {number} • {time}
      </p>
      <p
        className={`text-sm font-mono ${isRequest ? 'text-blue-300' : 'text-green-300'}`}
      >
        {isRequest ? '→' : '←'} &quot;{content}&quot;
      </p>
    </div>
  )
}

const SessionFeature = ({
  icon: Icon,
  color,
  title,
  description,
}: {
  icon: React.ElementType
  color: string
  title: string
  description: string
}) => (
  <div className="flex items-start gap-3">
    <div
      className={`w-8 h-8 ${color} rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5`}
    >
      <Icon className="w-5 h-5 text-blue-600" />
    </div>
    <div>
      <h4 className="font-semibold mb-1">{title}</h4>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  </div>
)

const SessionIntelligence = () => (
  <Section className="bg-gradient-to-b from-white to-blue-50/30">
    <div className="text-center mb-16">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-6">
        <Sparkles className="w-4 h-4" />
        {copy.sessionIntelligence.badge}
      </div>
      <h2 className="text-4xl md:text-5xl font-bold mb-4">
        <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          {copy.sessionIntelligence.title}
        </span>
      </h2>
      <p className="text-xl text-gray-600 max-w-3xl mx-auto">
        {copy.sessionIntelligence.subtitle}
      </p>
    </div>

    <div className="grid md:grid-cols-2 gap-12 items-center">
      <div>
        <h3 className="text-2xl font-bold mb-6">
          {copy.sessionIntelligence.mainFeatures.title}
        </h3>
        <p className="text-gray-600 mb-6">
          {copy.sessionIntelligence.mainFeatures.description}
        </p>

        <div className="space-y-4">
          <SessionFeature
            icon={Network}
            color="bg-blue-100"
            title={
              copy.sessionIntelligence.mainFeatures.features.detection.title
            }
            description={
              copy.sessionIntelligence.mainFeatures.features.detection
                .description
            }
          />
          <SessionFeature
            icon={Layers}
            color="bg-blue-100"
            title={copy.sessionIntelligence.mainFeatures.features.context.title}
            description={
              copy.sessionIntelligence.mainFeatures.features.context.description
            }
          />
        </div>
      </div>

      <SessionVisualization />
    </div>
  </Section>
)

export default function LandingPage({ loggedIn = false }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/20 to-purple-50/20">
      <Navigation loggedIn={loggedIn} />

      {/* Hero Section */}
      <Section className="pt-20 pb-32">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            {copy.hero.badge}
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              {copy.hero.title}
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
            {copy.hero.subtitle}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-xl transition-all duration-200 font-semibold text-lg group"
            >
              {copy.hero.cta.primary}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white border-2 border-gray-200 text-gray-700 rounded-xl hover:border-gray-300 hover:shadow-lg transition-all duration-200 font-semibold text-lg"
            >
              <Eye className="w-5 h-5" />
              {copy.hero.cta.secondary}
            </a>
          </div>
        </div>

        {/* Visual Elements */}
        <div className="mt-20 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 blur-3xl opacity-20"></div>
          <TerminalWindow>
            <pre>{`$ export ANTHROPIC_BASE_URL=https://${DOMAIN}/workspace-1/anthropic
$ claude 
> Build me a LangChain agent that teaches me how to cook sushi`}</pre>
          </TerminalWindow>
        </div>

        <ArrowDivider />

        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-blue-400 blur-3xl opacity-20"></div>
          <BrowserScreenshot
            imageSrc="/landing-screenshot.png"
            addressBarUrl={`${DOMAIN}/workspace-1/requests`}
          />
        </div>
      </Section>

      {/* How It Works */}
      <Section id="how-it-works" className="bg-white">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {copy.howItWorks.title}
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {copy.howItWorks.subtitle}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <HowItWorksStep
              icon={Network}
              title={copy.howItWorks.steps.create.title}
              description={copy.howItWorks.steps.create.description}
            />
            <HowItWorksStep
              icon={Activity}
              title={copy.howItWorks.steps.monitor.title}
              description={copy.howItWorks.steps.monitor.description}
            />
            <HowItWorksStep
              icon={Share2}
              title={copy.howItWorks.steps.share.title}
              description={copy.howItWorks.steps.share.description}
            />
          </div>

          <div className="relative">
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-8">
              <div className="mb-6">
                <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">
                  {copy.howItWorks.example.label}
                </span>
              </div>
              <div className="flex items-center gap-3 mb-6">
                <Terminal className="w-5 h-5 text-purple-600" />
                <span className="text-lg font-semibold text-gray-900">
                  {copy.howItWorks.example.title}
                </span>
              </div>
              <p className="text-gray-600 mb-6">
                {copy.howItWorks.example.description}{' '}
                <code className="px-2 py-1 bg-white rounded text-sm text-purple-600 font-mono">
                  {copy.howItWorks.example.variable}
                </code>
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-700">
                    {copy.howItWorks.example.points[0]}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-700">
                    {copy.howItWorks.example.points[1]}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-700">
                    {copy.howItWorks.example.points[2]}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Why Section */}
      <Section className="bg-gradient-to-b from-gray-50 to-white">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              {copy.why.title}
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {copy.why.subtitle}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={Eye}
            title={copy.features.visibility.title}
            description={copy.features.visibility.description}
            features={[...copy.features.visibility.points]}
          />
          <FeatureCard
            icon={Zap}
            title={copy.features.setup.title}
            description={copy.features.setup.description}
            features={[...copy.features.setup.points]}
          />
          <FeatureCard
            icon={GitBranch}
            title={copy.features.gateway.title}
            description={copy.features.gateway.description}
            features={[...copy.features.gateway.points]}
          />
        </div>
      </Section>

      {/* Session Intelligence Section */}
      <SessionIntelligence />

      {/* LLM Translation Gateway Section */}
      <Section className="bg-gradient-to-b from-blue-50/30 to-purple-50/30">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            {copy.gatewaySection.badge}
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
              {copy.gatewaySection.title}
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {copy.gatewaySection.subtitle}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h3 className="text-2xl font-bold mb-6">
              {copy.gatewaySection.universalTranslation.title}
            </h3>
            <p className="text-gray-600 mb-6">
              {copy.gatewaySection.universalTranslation.description}
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">
                    {
                      copy.gatewaySection.universalTranslation.features
                        .conversion.title
                    }
                  </h4>
                  <p className="text-sm text-gray-600">
                    {
                      copy.gatewaySection.universalTranslation.features
                        .conversion.description
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Eye className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">
                    {
                      copy.gatewaySection.universalTranslation.features
                        .visibility.title
                    }
                  </h4>
                  <p className="text-sm text-gray-600">
                    {
                      copy.gatewaySection.universalTranslation.features
                        .visibility.description
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          <TerminalWindow enableControls={false}>
            <div>
              <div className="mb-4 text-gray-500">
                # Your app thinks it&apos;s using Claude...
              </div>
              <div className="mb-2">
                $ export ANTHROPIC_BASE_URL={DOMAIN}/workspace-1/anthropic
              </div>
              <div className="mb-4">$ claude </div>

              <div className="mb-2 ">
                {'>'} Build me a LangChain agent that teaches me how to cook
                sushi
              </div>
              <div className="mb-4 text-gray-500">
                # Actually, claude talks with ChatGPT
              </div>
            </div>
          </TerminalWindow>
        </div>
      </Section>

      {/* Pricing Section */}
      <Section className="bg-gradient-to-b from-white to-purple-50/30">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            {copy.pricing.badge}
          </div>

          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {copy.pricing.title}
            </span>
          </h2>

          <div className="bg-white rounded-3xl p-12 shadow-xl border border-gray-100 mt-12">
            <div className="text-6xl font-bold mb-4">
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {copy.pricing.price}
              </span>
            </div>
            <p className="text-2xl text-gray-600 mb-8">
              {copy.pricing.subtitle}
            </p>
            <p className="text-gray-500 mb-8">{copy.pricing.description}</p>
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-xl transition-all duration-200 font-semibold text-lg group"
            >
              {copy.pricing.cta}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </Section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            {copy.cta.title}
          </h2>
          <p className="text-xl text-blue-100 mb-8">{copy.cta.subtitle}</p>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-purple-700 rounded-xl hover:shadow-2xl transition-all duration-200 font-semibold text-lg group"
          >
            {copy.cta.button}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl font-bold text-white">
                  {copy.brand.name}
                </span>
              </div>
              <p className="text-gray-400 text-sm">{copy.footer.copyright}</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
