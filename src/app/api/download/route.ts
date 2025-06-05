import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  await requireAuth()
  
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const type = searchParams.get('type')

    if (!id || !type || !['request', 'response'].includes(type)) {
      return NextResponse.json(
        { error: 'Missing or invalid id or type parameter. Type must be request or response.' },
        { status: 400 }
      )
    }

    const response = await prisma.response.findUnique({
      where: { id },
      select: {
        requestBody: true,
        responseBody: true,
        requestHeaders: true,
        responseHeaders: true,
      }
    })

    if (!response) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    const isRequest = type === 'request'
    const body = isRequest ? response.requestBody : response.responseBody
    const headers = isRequest ? response.requestHeaders : response.responseHeaders
    
    if (!body) {
      return NextResponse.json(
        { error: 'No body data found' },
        { status: 404 }
      )
    }

    // Get content type from headers
    const contentType = headers && typeof headers === 'object' 
      ? (headers as any)['content-type'] || 'application/octet-stream'
      : 'application/octet-stream'

    // Map content types to file extensions
    const getFileExtension = (contentType: string): string => {
      const mimeToExt: Record<string, string> = {
        'application/json': 'json',
        'application/xml': 'xml',
        'text/xml': 'xml',
        'text/html': 'html',
        'text/css': 'css',
        'text/javascript': 'js',
        'application/javascript': 'js',
        'text/plain': 'txt',
        'application/pdf': 'pdf',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/svg+xml': 'svg',
        'application/zip': 'zip',
        'application/octet-stream': 'bin',
        'video/mp4': 'mp4',
        'audio/mpeg': 'mp3',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.ms-excel': 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx'
      }
      
      // Check exact match first
      if (mimeToExt[contentType]) {
        return mimeToExt[contentType]
      }
      
      // Check partial matches
      if (contentType.includes('json')) return 'json'
      if (contentType.includes('xml')) return 'xml'
      if (contentType.includes('html')) return 'html'
      if (contentType.includes('css')) return 'css'
      if (contentType.includes('javascript')) return 'js'
      if (contentType.startsWith('text/')) return 'txt'
      if (contentType.startsWith('image/')) return 'img'
      if (contentType.startsWith('video/')) return 'video'
      if (contentType.startsWith('audio/')) return 'audio'
      
      return 'bin'
    }

    const extension = getFileExtension(contentType)
    const filename = `${type}-${id}.${extension}`

    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })

  } catch (error) {
    console.error('Error downloading body:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}