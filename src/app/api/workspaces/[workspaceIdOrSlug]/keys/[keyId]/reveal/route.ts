import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceIdOrSlug: string; keyId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { workspaceIdOrSlug, keyId } = await params

    // Find workspace and verify user has access
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceIdOrSlug }, { slug: workspaceIdOrSlug }],
        users: {
          some: {
            user: {
              email: session.user.email,
            },
          },
        },
      },
    })

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 }
      )
    }

    // Find the key
    const authKey = await prisma.authKey.findFirst({
      where: {
        id: keyId,
        workspaceId: workspace.id,
        deletedAt: null,
      },
    })

    if (!authKey) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 })
    }

    // Check if key is hashed
    if (authKey.hashed) {
      return NextResponse.json(
        { error: 'Cannot reveal hashed key' },
        { status: 400 }
      )
    }

    // Return the full key
    return NextResponse.json({ key: authKey.key })
  } catch (error) {
    console.error('Error revealing auth key:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
