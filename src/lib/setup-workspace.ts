import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

interface SetupWorkspaceParams {
  workspace: {
    id: string
  }
  user?: {
    id: string
    email: string
  }
}

interface SetupResult {
  upstreamsCreated: number
  keyCreated: boolean
  key?: string
}

/**
 * Sets up a workspace with default upstreams and auth key if they don't exist.
 *
 * - If workspace has no upstreams (including deleted), creates OpenAI and Anthropic upstreams
 * - If workspace has no active auth keys, creates a new key
 *
 * @param workspace - Workspace with at least an id
 * @param user - Optional user for logging/tracking purposes
 * @returns Result object with counts of created resources and the generated key (if created)
 */
export async function setupWorkspace({
  workspace,
}: SetupWorkspaceParams): Promise<SetupResult> {
  const result: SetupResult = {
    upstreamsCreated: 0,
    keyCreated: false,
  }

  // Check if workspace has any upstreams (including deleted ones)
  const existingUpstreams = await prisma.upstream.findMany({
    where: {
      workspaceId: workspace.id,
    },
    select: {
      id: true,
    },
  })

  // Create default upstreams if none exist
  if (existingUpstreams.length === 0) {
    // Create OpenAI upstream (Responses API)
    await prisma.upstream.create({
      data: {
        name: 'openai',
        url: 'https://api.openai.com/',
        inputFormat: 'openai',
        outputFormat: null,
        workspaceId: workspace.id,
      },
    })
    result.upstreamsCreated++

    // Create Anthropic upstream
    await prisma.upstream.create({
      data: {
        name: 'anthropic',
        url: 'https://api.anthropic.com/',
        inputFormat: 'anthropic',
        outputFormat: null,
        workspaceId: workspace.id,
      },
    })
    result.upstreamsCreated++
  }

  // Check if workspace has any active auth keys
  const existingKeys = await prisma.authKey.findMany({
    where: {
      workspaceId: workspace.id,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  })

  // Create a new auth key if none exist
  if (existingKeys.length === 0) {
    const apiKey = `sk_${crypto.randomBytes(32).toString('base64url')}`

    await prisma.authKey.create({
      data: {
        key: apiKey,
        workspaceId: workspace.id,
        hashed: false,
      },
    })

    result.keyCreated = true
    result.key = apiKey
  }

  return result
}
