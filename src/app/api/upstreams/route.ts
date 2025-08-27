import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkWorkspaceAuth } from '@/lib/auth'
import { UpstreamSchema } from '@/lib/upstream-types'
import { withError } from '@/lib/route-helpers'

export const GET = withError(async (request: NextRequest) => {
  const { workspace } = await checkWorkspaceAuth(request)

  const upstreams = await prisma.upstream.findMany({
    where: {
      deletedAt: null,
      workspaceId: workspace.id,
    },
    select: {
      id: true,
      name: true,
      url: true,
      headers: true,
      inputFormat: true,
      outputFormat: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return NextResponse.json(upstreams)
})

export const POST = withError(async (request: NextRequest) => {
  const { workspace } = await checkWorkspaceAuth(request)

  const body = await request.json()
  const validatedData = UpstreamSchema.parse(body)

  const existingUpstream = await prisma.upstream.findFirst({
    where: {
      name: validatedData.name,
      workspaceId: workspace.id,
    },
  })

  if (existingUpstream) {
    return NextResponse.json(
      { error: 'An upstream with this name already exists in this workspace' },
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
      workspaceId: workspace.id,
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

  return NextResponse.json(upstream)
})
