import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkWorkspaceAuth } from '@/lib/auth'
import { withError } from '@/lib/route-helpers'

export const GET = withError(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { workspace } = await checkWorkspaceAuth(request)
    const { id } = await params
    const requestData = await prisma.response.findUnique({
      where: {
        id,
        workspaceId: workspace.id,
      },
      select: {
        public: true,
      },
    })

    if (!requestData) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    return NextResponse.json({ public: requestData.public })
  }
)
