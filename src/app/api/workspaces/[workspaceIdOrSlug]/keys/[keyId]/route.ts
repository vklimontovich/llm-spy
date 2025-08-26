import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceIdOrSlug: string; keyId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { workspaceIdOrSlug, keyId } = await params

    // Find workspace and verify user has admin/owner access
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [
          { id: workspaceIdOrSlug },
          { slug: workspaceIdOrSlug }
        ],
        users: {
          some: {
            user: {
              email: session.user.email
            },
            role: { in: ['admin', 'owner'] } // Only admins/owners can delete keys
          }
        }
      }
    })

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found or insufficient permissions' }, { status: 404 })
    }

    // Soft delete the auth key
    await prisma.authKey.update({
      where: {
        id: keyId,
        workspaceId: workspace.id
      },
      data: {
        deletedAt: new Date()
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting auth key:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}