'use client'

import { useEffect, useRef, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import 'highlight.js/styles/github.css'

interface MultilineCodeBlockProps {
  children: React.ReactNode
  language?:
    | 'bash'
    | 'shell'
    | 'toml'
    | 'python'
    | 'typescript'
    | 'javascript'
    | 'json'
    | 'yaml'
    | 'plaintext'
  className?: string
  disableCopyIcon?: boolean
}

// Singleton promise for highlight.js initialization
let hljsInitPromise: Promise<any> | null = null

// Initialize highlight.js once and cache the result
function getHighlightJS() {
  if (!hljsInitPromise) {
    hljsInitPromise = (async () => {
      // Import highlight.js and languages
      const hljs = await import('highlight.js/lib/core').then(
        mod => mod.default
      )

      // Import only the languages we need
      const [bash, python, typescript, javascript, json, yaml, ini] =
        await Promise.all([
          import('highlight.js/lib/languages/bash').then(mod => mod.default),
          import('highlight.js/lib/languages/python').then(mod => mod.default),
          import('highlight.js/lib/languages/typescript').then(
            mod => mod.default
          ),
          import('highlight.js/lib/languages/javascript').then(
            mod => mod.default
          ),
          import('highlight.js/lib/languages/json').then(mod => mod.default),
          import('highlight.js/lib/languages/yaml').then(mod => mod.default),
          import('highlight.js/lib/languages/ini').then(mod => mod.default),
        ])

      // Register languages (happens only once)
      hljs.registerLanguage('bash', bash)
      hljs.registerLanguage('shell', bash)
      hljs.registerLanguage('python', python)
      hljs.registerLanguage('typescript', typescript)
      hljs.registerLanguage('javascript', javascript)
      hljs.registerLanguage('json', json)
      hljs.registerLanguage('yaml', yaml)
      hljs.registerLanguage('toml', ini)
      hljs.registerLanguage('plaintext', bash)

      return hljs
    })()
  }

  return hljsInitPromise
}

// Helper function to extract text content from React nodes
// This handles cases where we have inline components like KeyDisplayWrapper
function extractTextFromReactNode(node: React.ReactNode): string {
  if (typeof node === 'string') {
    return node
  }

  if (typeof node === 'number') {
    return String(node)
  }

  if (Array.isArray(node)) {
    return node.map(extractTextFromReactNode).join('')
  }

  if (node && typeof node === 'object' && 'props' in node) {
    const props = (node as any).props
    if (props.children) {
      return extractTextFromReactNode(props.children)
    }
  }

  return ''
}

export default function MultilineCodeBlock({
  children,
  language = 'bash',
  className,
  disableCopyIcon = false,
}: MultilineCodeBlockProps) {
  const codeRef = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState(false)

  // Convert React nodes to string for syntax highlighting
  const codeString =
    typeof children === 'string' ? children : extractTextFromReactNode(children)

  useEffect(() => {
    const highlightCode = async () => {
      if (codeRef.current) {
        // Get the initialized hljs instance (happens once globally)
        const hljs = await getHighlightJS()

        // Highlight the code element
        hljs.highlightElement(codeRef.current)
      }
    }

    highlightCode()
  }, [codeString, language])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeString)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  return (
    <div className="group relative">
      {!disableCopyIcon && (
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 border border-gray-200
                     opacity-0 group-hover:opacity-100 transition-all duration-200
                     hover:bg-gray-50 hover:scale-110 active:scale-95 cursor-pointer z-10"
          aria-label="Copy code"
        >
          {copied ? (
            <Check
              size={14}
              className="text-green-600 animate-in fade-in zoom-in"
            />
          ) : (
            <Copy size={14} className="text-gray-600" />
          )}
        </button>
      )}
      <pre className={className}>
        <code ref={codeRef} className={`language-${language}`}>
          {codeString}
        </code>
      </pre>
    </div>
  )
}
