import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkWorkspaceAuth } from '@/lib/auth'
import { withError } from '@/lib/route-helpers'

export const POST = withError(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { workspace } = await checkWorkspaceAuth(request)

  const { public: isPublic } = await request.json()
  const { id } = await params

  const updatedResponse = await prisma.response.update({
    where: {
      id,
      workspaceId: workspace.id,
    },
    data: { public: isPublic },
    select: { id: true, public: true },
  })

  return NextResponse.json(updatedResponse)
})