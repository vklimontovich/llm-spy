import ChatViewToolPage from '@/components/ChatViewToolPage'

interface PageProps {
  params: Promise<{
    provider: string
  }>
}

export default async function ChatViewProviderPage({ params }: PageProps) {
  const { provider } = await params
  return <ChatViewToolPage defaultProvider={provider} />
}
