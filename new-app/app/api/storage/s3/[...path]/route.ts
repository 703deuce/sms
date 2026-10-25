import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function internalBase() {
  const base = process.env.S3_ENDPOINT?.trim()
  if (!base) throw new Error('S3_ENDPOINT not configured')
  return base.replace(/\/$/, '')
}

async function proxy(request: Request, pathSegments: string[]) {
  const path = pathSegments.map((p) => encodeURIComponent(p)).join('/')
  const url = new URL(request.url)
  const target = `${internalBase()}/${path}${url.search}`
  const headers = new Headers()
  const contentType = request.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)
  const contentLength = request.headers.get('content-length')
  if (contentLength) headers.set('content-length', contentLength)
  const auth = request.headers.get('authorization')
  if (auth) headers.set('authorization', auth)
  const amzDate = request.headers.get('x-amz-date')
  if (amzDate) headers.set('x-amz-date', amzDate)
  const amzContent = request.headers.get('x-amz-content-sha256')
  if (amzContent) headers.set('x-amz-content-sha256', amzContent)
  const amzSecurity = request.headers.get('x-amz-security-token')
  if (amzSecurity) headers.set('x-amz-security-token', amzSecurity)

  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body
  const upstream = await fetch(target, { method: request.method, headers, body })

  const outHeaders = new Headers(upstream.headers)
  outHeaders.set('access-control-allow-origin', process.env.S3_CORS_ORIGIN?.trim() || 'https://transovo.ai')
  outHeaders.set('access-control-allow-methods', 'GET,PUT,POST,DELETE,HEAD,OPTIONS')
  outHeaders.set('access-control-allow-headers', '*')
  outHeaders.set('access-control-expose-headers', 'ETag')

  return new NextResponse(upstream.body, { status: upstream.status, headers: outHeaders })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': process.env.S3_CORS_ORIGIN?.trim() || 'https://transovo.ai',
      'access-control-allow-methods': 'GET,PUT,POST,DELETE,HEAD,OPTIONS',
      'access-control-allow-headers': '*',
    },
  })
}

export async function GET(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  return proxy(request, path)
}

export async function PUT(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  return proxy(request, path)
}

export async function POST(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  return proxy(request, path)
}

export async function DELETE(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  return proxy(request, path)
}

export async function HEAD(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  return proxy(request, path)
}
