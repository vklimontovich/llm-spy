import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();

    const { public: isPublic } = await request.json()

    const updatedResponse = await prisma.response.update({
      where: { id: (await params).id },
      data: { public: isPublic },
      select: { id: true, public: true }
    })

    return NextResponse.json(updatedResponse)
  } catch (error) {
    console.error('Error updating share status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}