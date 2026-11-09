import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { analyzeMotionReferenceImages } from '@/lib/clips/motion-graphics/reference-analyzer'
import { jsonError } from '@/lib/server/api-error'

const Body = z.object({
  authorized: z.literal(true),
  images: z.array(z.object({
    mimeType: z.enum(['image/jpeg', 'image/png']),
    base64: z.string().min(100).max(2_800_000),
  }).strict()).min(1).max(3),
  instructions: z.string().max(1000).optional(),
}).strict()

/**
 * Accepts screenshots uploaded in the active editor session, never a remote URL.
 * Confirmation that references are authorized is required.
 */
export async function POST(request: Request) {
  try {
    await resolveWorkspaceId()
    const raw = await request.text()
    if (raw.length > 8_500_000) return NextResponse.json({ error: 'Images too large' }, { status: 413 })
    const body = Body.parse(JSON.parse(raw))
    const decoded = body.images.map(i => ({
      mimeType: i.mimeType,
      bytes: Buffer.from(i.base64, 'base64'),
    }))
    for (const image of decoded) {
      if (image.bytes.length > 2_000_000 || image.bytes.length < 100)
        return NextResponse.json({ error: 'Invalid image size' }, { status: 413 })
      if (image.mimeType === 'image/png' && !image.bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
        return NextResponse.json({ error: 'Invalid PNG file' }, { status: 400 })
      if (image.mimeType === 'image/jpeg' && (image.bytes[0] !== 255 || image.bytes[1] !== 216))
        return NextResponse.json({ error: 'Invalid JPEG file' }, { status: 400 })
    }
    const result = await analyzeMotionReferenceImages(decoded, body.instructions)
    return NextResponse.json({ data: result })
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError)
      return NextResponse.json({ error: 'Invalid style reference upload' }, { status: 400 })
    return jsonError(new Error('motion_reference_analysis_failed'), 500)
  }
}
