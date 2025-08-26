import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { UpstreamSchema } from '@/lib/upstream-types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await requireAuth()
  
  try {
    const upstream = await prisma.upstream.findUnique({
      where: {
        id: id,
        deletedAt: null
      },
      include: {
        otelUpstreams: true
      }
    })

    if (!upstream) {
      return NextResponse.json(
        { error: 'Upstream not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(upstream)
  } catch (error) {
    console.error('Error fetching upstream:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await requireAuth()
  
  try {
    const body = await request.json()
    const validatedData = UpstreamSchema.parse(body)

    const existingUpstream = await prisma.upstream.findUnique({
      where: { id: id, deletedAt: null },
      include: { otelUpstreams: true }
    })

    if (!existingUpstream) {
      return NextResponse.json(
        { error: 'Upstream not found' },
        { status: 404 }
      )
    }

    const existingWithSameName = await prisma.upstream.findFirst({
      where: {
        name: validatedData.name,
        deletedAt: null,
        NOT: { id: id }
      }
    })

    if (existingWithSameName) {
      return NextResponse.json(
        { error: 'An upstream with this name already exists' },
        { status: 400 }
      )
    }

    const updatedUpstream = await prisma.$transaction(async (tx) => {
      await tx.otelUpstream.deleteMany({
        where: { upstreamId: id }
      })

      const upstream = await tx.upstream.update({
        where: { id: id },
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

      return upstream
    })

    return NextResponse.json(updatedUpstream)
  } catch (error) {
    console.error('Error updating upstream:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await requireAuth()
  
  try {
    const existingUpstream = await prisma.upstream.findUnique({
      where: { id: id, deletedAt: null }
    })

    if (!existingUpstream) {
      return NextResponse.json(
        { error: 'Upstream not found' },
        { status: 404 }
      )
    }

    // Soft delete
    await prisma.upstream.update({
      where: { id: id },
      data: { deletedAt: new Date() }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting upstream:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}