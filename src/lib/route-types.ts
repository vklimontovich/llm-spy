import { ConversationModel } from '@/lib/format'

export type LlmRequest = {
  rawRequest?: any
  rawResponse?: any
  provider?: string
  conversation?: ConversationModel
}
