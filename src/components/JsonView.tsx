'use client'

import { useState } from 'react'
import { Segmented, Button, message } from 'antd'
import { Copy, Check } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import * as YAML from 'yaml'
import dynamic from 'next/dynamic'
import styles from './JsonView.module.css'

const ReactJsonView = dynamic(() => import('@microlink/react-json-view'), {
  ssr: false,
  loading: () => <div className="p-3">Loading...</div>
})


interface JsonViewProps {
  data: any
  className?: string
  simple?: boolean
}

type ViewMode = 'json' | 'yaml' | 'tree'

export default function JsonView({ data, className = '', simple = false }: JsonViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('json')
  const [copied, setCopied] = useState(false)

  const jsonString = JSON.stringify(data, null, 2)
  const yamlString = YAML.stringify(data)

  const handleCopy = async () => {
    let textToCopy = ''

    if (simple) {
      textToCopy = jsonString
    } else {
      switch (viewMode) {
        case 'json':
          textToCopy = jsonString
          break
        case 'yaml':
          textToCopy = yamlString
          break
        case 'tree':
          textToCopy = jsonString // For tree view, copy as JSON
          break
      }
    }

    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      message.success('Copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      message.error('Failed to copy')
    }
  }

  const renderContent = () => {
    if (simple) {
      return (
        <div className={styles.syntaxHighlighterWrapper}>
          <SyntaxHighlighter
            language="json"
            style={oneLight}
            className="!m-0 !px-3 !py-4 !text-xs !leading-normal !bg-transparent !border-none"
            wrapLongLines
          >
            {jsonString}
          </SyntaxHighlighter>
        </div>
      )
    }

    switch (viewMode) {
      case 'json':
        return (
          <div className={styles.syntaxHighlighterWrapper}>
            <SyntaxHighlighter
              language="json"
              style={oneLight}
              className="!m-0 !px-3 !py-4 !text-xs !leading-normal !bg-transparent !border-none"
              wrapLongLines
            >
              {jsonString}
            </SyntaxHighlighter>
          </div>
        )
      case 'yaml':
        return (
          <div className={styles.syntaxHighlighterWrapper}>
            <SyntaxHighlighter
              language="yaml"
              style={oneLight}
              className="!m-0 !px-3 !py-4 !text-xs !leading-normal !bg-transparent !border-none"
              wrapLongLines
            >
              {yamlString}
            </SyntaxHighlighter>
          </div>
        )
      case 'tree':
        return (
          <div className="p-3">
            <ReactJsonView
              src={data}
              theme="bright:inverted"
              displayDataTypes={false}
              displayObjectSize={false}
              enableClipboard={false}
              collapsed={2}
              style={{ backgroundColor: 'transparent' }}
            />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className={`relative ${className}`}>
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        {!simple && (
          <Segmented
            size="small"
            value={viewMode}
            onChange={(value) => setViewMode(value as ViewMode)}
            options={[
              { label: 'JSON', value: 'json' },
              { label: 'YAML', value: 'yaml' },
              { label: 'Tree', value: 'tree' }
            ]}
          />
        )}
        <Button
          type="text"
          size="small"
          icon={copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          onClick={handleCopy}
          className="flex items-center"
        />
      </div>
      <div className="overflow-auto rounded-lg shadow bg-gray-120">
        {renderContent()}
      </div>
    </div>
  )
}