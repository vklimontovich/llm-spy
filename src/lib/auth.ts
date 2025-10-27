import { getServerSession } from 'next-auth'
import { getAuthOptions } from '@/lib/auth-config'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'
import { requireDefined } from '@/lib/preconditions'
import type { Key } from '@/schemas/keys'

export async function getSession() {
  return await getServerSession(getAuthOptions())
}

export async function requireAuth() {
  const session = await getSession()
  if (!session) {
    console.log('Session not found')
    throw new Error(`Session not found`)
  }
  if (!session.user) {
    console.log('Session user is missing', session)
    throw new Error(`Session user is missing`)
  }
  if (!session.user.email) {
    console.log('User email is missing', session)
    throw new Error(`User email is missing`)
  }

  return session
}

export async function hasAuth() {
  const session = await getSession()
  return !!session?.user?.email
}

export function getWorkspaceIdOrSlug(request: NextRequest): string | null {
  const workspaceHeader = request.headers.get('X-Workspace-Id')
  if (workspaceHeader) {
    return workspaceHeader
  }

  const url = new URL(request.url)
  return url.searchParams.get('workspaceId')
}

export async function requireWorkspaceAccess(
  workspaceIdOrSlug: string,
  userEmail: string
): Promise<{ id: string; slug: string; name: string; role: string }> {
  const workspace = await prisma.workspace.findFirst({
    where: {
      OR: [{ id: workspaceIdOrSlug }, { slug: workspaceIdOrSlug }],
      users: {
        some: {
          user: {
            email: userEmail,
          },
        },
      },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      users: {
        where: {
          user: {
            email: userEmail,
          },
        },
        select: {
          role: true,
        },
      },
    },
  })

  if (!workspace) {
    throw new Error(`Workspace ${workspaceIdOrSlug} not found or access denied`)
  }

  return {
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    role: workspace.users[0]?.role || 'member',
  }
}

export async function checkWorkspaceAuth(request: NextRequest): Promise<{
  session: Awaited<ReturnType<typeof requireAuth>>
  workspace: { id: string; slug: string; name: string; role: string }
}> {
  const session = await requireAuth()
  const workspaceIdOrSlug = getWorkspaceIdOrSlug(request)

  if (!workspaceIdOrSlug) {
    throw new Error(
      'X-Workspace-Id header or workspaceId parameter is required'
    )
  }

  const workspace = await requireWorkspaceAccess(
    workspaceIdOrSlug,
    requireDefined(session?.user?.email, 'User email is required in session')
  )

  return { session, workspace }
}

/**
 * Creates a hint for a key
 * - If hashed: "(hashed)"
 * - If not hashed: "sk_...xxx" where total length matches the key length
 */
export function createKeyHint(key: string, hashed: boolean): string {
  if (hashed) {
    return '(hashed)'
  }

  if (key.length <= 6) {
    // If key is too short, just show dots
    return '•'.repeat(key.length)
  }

  const first3 = key.substring(0, 3)
  const last3 = key.substring(key.length - 3)
  const middleLength = key.length - 6
  const middle = '•'.repeat(middleLength)

  return `${first3}${middle}${last3}`
}

/**
 * Converts a database key record to a Key model
 */
export function toKeyModel(dbKey: {
  id: string
  key: string
  hashed: boolean
}): Key {
  return {
    id: dbKey.id,
    hashed: dbKey.hashed,
    hint: createKeyHint(dbKey.key, dbKey.hashed),
  }
}
