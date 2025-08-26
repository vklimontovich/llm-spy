import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod/v4';

type RouteHandler = (request: NextRequest) => Promise<Response | any>;

export class HttpError extends Error {
  status: number
  cause?: unknown

  constructor(status: number, message?: string, { cause }: { cause?: unknown } = {}) {
    super(message, cause ? { cause } : undefined)
    this.status = status
    this.name = 'HttpError'
    this.cause = cause
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export function withError(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest) => {
    try {
      const result = await handler(request)
      if (result instanceof Response) {
        return result
      } else if (result === undefined) {
        return new Response(null, { status: 204 }) // No Content
      } else {
        return NextResponse.json(result, { status: 200 }) // Return JSON response
      }
    } catch (error) {
      console.error('Route error:', error)
      if (error instanceof HttpError) {
        return NextResponse.json(
          {
            error: error.message || 'An error occurred',
            details: error.cause ? String(error.cause) : undefined,
          },
          { status: error.status },
        )
      } else if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid request - zod error',
            issues: error.issues,
          },
          { status: 400 },
        )
      }
      return NextResponse.json(
        {
          error: 'Internal server error',
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 },
      )
    }
  }
}