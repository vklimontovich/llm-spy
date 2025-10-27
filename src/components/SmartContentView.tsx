import JsonView from './JsonView'

interface SmartContentViewProps {
  data: any
  className?: string
}

export default function SmartContentView({
  data,
  className = '',
}: SmartContentViewProps) {
  // If it's already an object, use JsonView directly
  if (typeof data === 'object' && data !== null) {
    return <JsonView data={data} className={className} />
  }

  // If it's a string, try to parse as JSON or detect images
  if (typeof data === 'string') {
    // Check if it's an image data URL or image URL
    if (
      data.startsWith('data:image/') ||
      (data.startsWith('http') &&
        /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(data))
    ) {
      return (
        <img
          src={data}
          alt="Content"
          className={`max-w-full max-h-96 rounded-lg border border-gray-200 shadow-sm ${className}`}
          style={{ objectFit: 'contain' }}
        />
      )
    }

    try {
      const parsed = JSON.parse(data)
      return <JsonView data={parsed} className={className} />
    } catch {
      // Not valid JSON, display as plain text
      // TODO: In the future, check if it's markdown and format accordingly
      return (
        <pre
          className={`text-xs font-mono overflow-auto whitespace-pre-wrap text-gray-800 leading-relaxed ${className}`}
        >
          {data}
        </pre>
      )
    }
  }

  // For other types, convert to string and display as plain text
  return (
    <pre
      className={`text-xs font-mono overflow-auto whitespace-pre-wrap text-gray-800 leading-relaxed ${className}`}
    >
      {String(data)}
    </pre>
  )
}
