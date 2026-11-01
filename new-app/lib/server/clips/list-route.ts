import { NextResponse } from 'next/server'
import { formatApiErrorMessage } from '@/lib/server/api-error'

/**
 * G4c: the editor GETs /api/clips/fonts on every load (LUTs when the picker opens). Those GETs
 * used `jsonError(err, 400)`, so ANY server-side failure (workspace lookup, the clip_fonts /
 * clip_luts table missing because a migration was not applied yet, a stale Prisma client without
 * the model) came back as a 400 "bad request" in the console although the request had no input.
 *
 * Now: a missing table / model is not an error for a read-only list → 200 with an empty list and
 * `unavailable: true` (the panels keep working with built-in fonts / LUTs) and one server log line
 * naming the cause; anything else is a 500 with the message (never 400: there is nothing to fix
 * in the request).
 */
export function isSchemaMissingError(err: unknown): boolean {
  const e = err as { code?: unknown; message?: unknown } | null
  if (e && (e.code === 'P2021' || e.code === 'P2022')) return true
  const msg = typeof e?.message === 'string' ? e.message : ''
  return (
    /relation .* does not exist/i.test(msg) ||
    /table .* does not exist/i.test(msg) ||
    /Cannot read properties of undefined \(reading 'findMany'\)/.test(msg)
  )
}

export async function workspaceListResponse<K extends string, T>(
  tag: string,
  key: K,
  load: () => Promise<T[]>,
): Promise<NextResponse> {
  try {
    return NextResponse.json({ data: { [key]: await load() } })
  } catch (err) {
    const message = formatApiErrorMessage(err)
    if (isSchemaMissingError(err)) {
      console.warn(`[clipper:${tag}] list_unavailable`, message)
      return NextResponse.json({ data: { [key]: [], unavailable: true } })
    }
    console.warn(`[clipper:${tag}] list_fail`, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
