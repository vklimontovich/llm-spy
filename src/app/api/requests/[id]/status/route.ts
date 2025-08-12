import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '@/lib/auth'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAuth()

  try {
    const { id } = await params
    const requestData = await prisma.response.findUnique({
      where: {
        id,
      },
      select: {
        public: true
      }
    })

    if (!requestData) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    return NextResponse.json({ public: requestData.public })
  } catch (error) {
    console.error('Error fetching share status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}