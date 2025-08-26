export default function TerminalWindow({
  children,
  enableControls = true,
  title = "llm-spy-monitor"
}: {
  children: React.ReactNode
  enableControls?: boolean
  title?: string
}) {
  return (
    <div className="relative bg-gray-900 rounded-2xl p-6 shadow-2xl">
      {enableControls && (
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="ml-4 text-gray-400 text-sm font-mono">{title}</span>
        </div>
      )}
      <div className="text-green-400 font-mono text-sm overflow-x-auto">
        {children}
      </div>
    </div>
  )
}