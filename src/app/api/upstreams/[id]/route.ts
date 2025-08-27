import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkWorkspaceAuth } from '@/lib/auth'
import { UpstreamSchema } from '@/lib/upstream-types'
import { withError } from '@/lib/route-helpers'

export const GET = withError(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id } = await params
    const { workspace } = await checkWorkspaceAuth(request)
    const upstream = await prisma.upstream.findUnique({
      where: {
        id: id,
        deletedAt: null,
        workspaceId: workspace.id,
      },
      include: {
        otelUpstreams: true,
      },
    })

    if (!upstream) {
      return NextResponse.json({ error: 'Upstream not found' }, { status: 404 })
    }

    return NextResponse.json(upstream)
  }
)

export const PUT = withError(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id } = await params
    const { workspace } = await checkWorkspaceAuth(request)
    const body = await request.json()
    const validatedData = UpstreamSchema.parse(body)

    const existingUpstream = await prisma.upstream.findUnique({
      where: { id: id, deletedAt: null, workspaceId: workspace.id },
      include: { otelUpstreams: true },
    })

    if (!existingUpstream) {
      return NextResponse.json({ error: 'Upstream not found' }, { status: 404 })
    }

    const existingWithSameName = await prisma.upstream.findFirst({
      where: {
        name: validatedData.name,
        deletedAt: null,
        workspaceId: workspace.id,
        NOT: { id: id },
      },
    })

    if (existingWithSameName) {
      return NextResponse.json(
        { error: 'An upstream with this name already exists' },
        { status: 400 }
      )
    }

    const updatedUpstream = await prisma.$transaction(async tx => {
      await tx.otelUpstream.deleteMany({
        where: { upstreamId: id },
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
              headers: otel.headers || [],
            })),
          },
        },
        include: {
          otelUpstreams: true,
        },
      })

      return upstream
    })

    return NextResponse.json(updatedUpstream)
  }
)

export const DELETE = withError(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { id } = await params
    const { workspace } = await checkWorkspaceAuth(request)
    const existingUpstream = await prisma.upstream.findUnique({
      where: { id: id, deletedAt: null, workspaceId: workspace.id },
    })

    if (!existingUpstream) {
      return NextResponse.json({ error: 'Upstream not found' }, { status: 404 })
    }

    // Soft delete
    await prisma.upstream.update({
      where: { id: id },
      data: { deletedAt: new Date() },
    })

    return NextResponse.json({ success: true })
  }
)
