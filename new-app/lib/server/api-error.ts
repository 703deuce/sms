import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export function formatApiErrorMessage(err: unknown): string {
  if (err instanceof ZodError) {
    const first = err.issues[0]
    if (!first) return 'Invalid request'
    const field = first.path.length ? first.path.join('.') : 'request'
    return `Invalid ${field}: ${first.message}`
  }
  if (err instanceof Error) return err.message
  return 'Request failed'
}

export function jsonError(err: unknown, status = 500) {
  const message = formatApiErrorMessage(err)
  const code = err instanceof ZodError ? 400 : status >= 500 ? status : 400
  return NextResponse.json({ error: message }, { status: code })
}
