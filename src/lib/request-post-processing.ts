import { detectProviderFromRequest, getParserForProvider } from '@/lib/format'
import { isSSEResponse, parseSSEEvents } from '@/lib/sse-utils'
import { getPricing } from '@/lib/pricing'
import { getPreview } from '@/lib/preview'

export interface PostProcessingInput {
  requestBody: Buffer | null
  responseBody: Buffer
  requestHeaders: Record<string, string>
  responseHeaders: Record<string, string>
  provider?: string | null
}

export interface PostProcessingResult {
  provider: string | null
  requestModel?: string
  responseModel?: string
  usage?: any
  pricing?: any
  preview?: { input: string; output: string }
}

/**
 * Post-processes request/response data to extract model information,
 * usage, pricing, and preview data.
 */
export async function postProcessResponse(
  input: PostProcessingInput
): Promise<PostProcessingResult> {
  const {
    requestBody,
    responseBody,
    requestHeaders,
    responseHeaders,
    provider: initialProvider,
  } = input

  let provider = initialProvider || null
  let requestModel: string | undefined
  let responseModel: string | undefined
  let usageRaw: any | undefined
  let pricingData: any | undefined
  let preview: { input: string; output: string } | undefined

  try {
    // Try to detect provider from request if not set
    if (!provider && requestBody) {
      const requestJson = JSON.parse(requestBody.toString('utf-8'))
      provider = detectProviderFromRequest(requestHeaders, requestJson)
    }

    // Get parser for the provider
    const parser = getParserForProvider(provider)
    if (parser && requestBody) {
      try {
        const requestJson = JSON.parse(requestBody.toString('utf-8'))
        // Parse response as JSON or reconstruct from SSE when streaming
        let responseJson: any
        const responseText = responseBody.toString('utf-8')
        if (isSSEResponse(responseHeaders)) {
          responseJson = parser.getJsonFromSSE(parseSSEEvents(responseText))
        } else {
          try {
            responseJson = JSON.parse(responseText)
          } catch {
            // Fallback: attempt SSE reconstruction if JSON parsing fails
            responseJson = parser.getJsonFromSSE(parseSSEEvents(responseText))
          }
        }

        const conversationModel = parser.createConversation(
          requestJson,
          responseJson
        )
        if (conversationModel) {
          requestModel = conversationModel.models.request
          responseModel = conversationModel.models.response
          // Persist the raw usage block from provider if available
          usageRaw = (responseJson as any)?.usage ?? conversationModel.usage

          // Calculate pricing lookup; save raw cost node as-is
          if (responseModel) {
            pricingData = await getPricing(responseModel)
            if (pricingData) {
              console.log(`[pricing] Found cost for ${responseModel}`)
            } else {
              console.warn(`[pricing] No cost found for model ${responseModel}`)
            }
          }

          // Generate preview from conversation
          const messages = conversationModel.modelMessages
          const lastUserMessage = messages.findLast(m => m.role === 'user')
          const lastAssistantMessage = messages.findLast(
            m => m.role === 'assistant'
          )

          preview = {
            input: getPreview(lastUserMessage, 100),
            output: getPreview(lastAssistantMessage, 100),
          }
        }
      } catch (parseError) {
        console.warn('Failed to parse conversation model:', parseError)
      }
    }
  } catch (error) {
    console.warn('Failed to extract model information:', error)
  }

  return {
    provider,
    requestModel,
    responseModel,
    usage: usageRaw,
    pricing: pricingData,
    preview,
  }
}
