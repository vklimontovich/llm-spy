import { Eye } from 'lucide-react'

interface BrowserScreenshotProps {
  imageSrc?: string
  showAddressBar?: boolean
  addressBarUrl?: string
}

export default function BrowserScreenshot({ 
  imageSrc, 
  showAddressBar = true,
  addressBarUrl = "llm-spy.com/workspace-1/requests"
}: BrowserScreenshotProps) {
  return (
    <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200">
      {showAddressBar && (
        <div className="flex items-center gap-2 p-4 border-b border-gray-200">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <div className="ml-4 flex-1 bg-gray-100 rounded-md px-3 py-1 text-sm text-gray-500">
            {addressBarUrl}
          </div>
        </div>
      )}
      <div className={showAddressBar ? "" : "rounded-2xl overflow-hidden"}>
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt="LLM SPY Dashboard"
            className={`w-full h-auto ${showAddressBar ? 'rounded-b-lg' : 'rounded-2xl'}`}
          />
        ) : (
          <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center p-8">
            <div className="text-center">
              <Eye className="w-16 h-16 text-blue-500 mx-auto mb-4" />
              <p className="text-gray-600">Dashboard Screenshot Coming Soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}