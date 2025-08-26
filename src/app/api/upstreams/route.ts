import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { UpstreamSchema } from '@/lib/upstream-types'

export async function GET() {
  await requireAuth()
  
  try {
    const upstreams = await prisma.upstream.findMany({
      where: {
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        url: true,
        headers: true,
        inputFormat: true,
        outputFormat: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(upstreams)

  } catch (error) {
    console.error('Error fetching upstreams:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  await requireAuth()
  
  try {
    const body = await request.json()
    const validatedData = UpstreamSchema.parse(body)

    const existingUpstream = await prisma.upstream.findUnique({
      where: { name: validatedData.name }
    })

    if (existingUpstream) {
      return NextResponse.json(
        { error: 'An upstream with this name already exists' },
        { status: 400 }
      )
    }

    const upstream = await prisma.upstream.create({
      data: {
        name: validatedData.name,
        url: validatedData.url || null,
        headers: validatedData.headers,
        inputFormat: validatedData.inputFormat,
        outputFormat: validatedData.outputFormat,
        otelUpstreams: {
          create: validatedData.otelUpstreams.map(otel => ({
            url: otel.url,
            headers: otel.headers || []
          }))
        }
      },
      include: {
        otelUpstreams: true
      }
    })

    return NextResponse.json(upstream)
  } catch (error) {
    console.error('Error creating upstream:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}