import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertDefined, requireDefined } from '@/lib/preconditions'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceIdOrSlug: string }> }
) {
  try {
    const session = await requireAuth()
    assertDefined(session.user, 'Session user is missing')
    const email = requireDefined(session.user.email, 'User email is missing')
    const { workspaceIdOrSlug } = await params

    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceIdOrSlug }, { slug: workspaceIdOrSlug }],
        users: { some: { user: { email } } },
      },
      select: {
        id: true,
        slug: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        users: {
          where: {
            user: {
              email,
            },
          },
          select: {
            role: true,
          },
        },
      },
    })

    if (!workspace) {
      return Response.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 }
      )
    }

    return Response.json({
      id: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
      role: workspace.users[0]?.role || 'member',
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    })
  } catch (error) {
    console.error('Error fetching workspace:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
