import {NextRequest, NextResponse} from 'next/server'
import {prisma} from '@/lib/prisma'
import {requireAuth} from '@/lib/auth'
import {convertProtobufToJson} from '@/lib/content-utils'
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
        'image/png': 'png',
        'image/gif': 'gif',
        'image/svg+xml': 'svg',
        'application/zip': 'zip',
        'application/octet-stream': 'bin',
        'video/mp4': 'mp4',
        'audio/mpeg': 'mp3'
    }

    if (mimeToExt[contentType]) {
        return mimeToExt[contentType]
    }

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

export async function GET(request: NextRequest) {
    await requireAuth()

    try {
        const {searchParams} = new URL(request.url)
        const id = searchParams.get('id')
        const type = searchParams.get('type')
        const download = searchParams.get('download') === 'true'
        const format = searchParams.get('format')

        if (!id || !type || !['request', 'response'].includes(type)) {
            return NextResponse.json(
                {error: 'Missing or invalid id or type parameter. Type must be request or response.'},
                {status: 400}
            )
        }

        const response = await prisma.response.findUnique({where: {id}})

        if (!response) {
            return NextResponse.json(
                {error: 'Request not found'},
                {status: 404}
            )
        }

        const isRequest = type === 'request'
        const body = isRequest ? response.requestBody : response.responseBody
        const headers = isRequest ? response.requestHeaders : response.responseHeaders

        // Get content type from headers
        const contentType = headers && typeof headers === 'object'
            ? (headers as Record<string, string>)['content-type'] || ''
            : ''

        // Handle OTEL JSON format conversion
        if (format === 'otel-json' && body) {
            try {
                const contentEncoding = headers && typeof headers === 'object'
                    ? (headers as Record<string, string>)['content-encoding']
                    : undefined

                // Handle Uint8Array from Prisma
                const uint8Array = body instanceof Uint8Array ? body : new Uint8Array(Buffer.from(body, 'binary'))
                const arrayBuffer = uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength) as ArrayBuffer
                const otelJson = await convertProtobufToJson(arrayBuffer, contentEncoding)
                
                return new NextResponse(otelJson, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(otelJson, 'utf8').toString()
                    }
                })
            } catch (error) {
                return NextResponse.json(
                    {
                        error: 'Failed to convert protobuf to OTEL JSON',
                        details: error instanceof Error ? error.message : 'Unknown error'
                    },
                    {status: 500}
                )
            }
        }

        // If download is requested, return file
        if (download && body) {
            const extension = getFileExtension(contentType)
            const filename = `${type}-${id}.${extension}`

            return new NextResponse(body, {
                headers: {
                    'Content-Type': contentType || 'application/octet-stream',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                },
            })
        }

        if (!body) {
            return new NextResponse(null, { status: 204 })
        } else {
            // Return body as-is with proper content type, mimicking the original response/request
            return new NextResponse(body, {
                headers: {
                    'Content-Type': contentType || 'application/octet-stream',
                    'Content-Length': body.length.toString()
                }
            })
        }

    } catch (error) {
        console.error('Error fetching body:', error)
        return NextResponse.json(
            {
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            {status: 500}
        )
    }
}