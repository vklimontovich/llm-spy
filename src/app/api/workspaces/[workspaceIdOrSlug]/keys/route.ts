import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import crypto from 'crypto'
import { toKeyModel } from '@/lib/model/keys'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceIdOrSlug: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { workspaceIdOrSlug } = await params

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
      include: {
        authKeys: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            createdAt: 'desc',
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

    // Return keys using KeyModel
    const keys = workspace.authKeys.map(key => toKeyModel(key))

    return NextResponse.json(keys)
  } catch (error) {
    console.error('Error fetching auth keys:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceIdOrSlug: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { workspaceIdOrSlug } = await params

    // Find workspace and verify user has access
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceIdOrSlug }, { slug: workspaceIdOrSlug }],
        users: {
          some: {
            user: {
              email: session.user.email,
            },
            role: { in: ['admin', 'owner'] }, // Only admins/owners can create keys
          },
        },
      },
    })

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found or insufficient permissions' },
        { status: 404 }
      )
    }

    // Generate a secure API key
    const apiKey = `sk_${crypto.randomBytes(32).toString('base64url')}`

    const authKey = await prisma.authKey.create({
      data: {
        key: apiKey,
        workspaceId: workspace.id,
        hashed: false,
      },
    })

    return NextResponse.json({
      id: authKey.id,
      key: apiKey, // Return full key only on creation
      createdAt: authKey.createdAt,
    })
  } catch (error) {
    console.error('Error creating auth key:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
