import Link from 'next/link'

interface LogoProps {
  href?: string
  className?: string
}

export default function Logo({ href = '/', className = '' }: LogoProps) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 group ${className}`}>
      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
        <span className="text-white font-bold text-sm">LS</span>
      </div>
      <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
        LLM SPY
      </span>
    </Link>
  )
}