import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { getActor } from '@/lib/screenwriting/server/actor'
import { createSwProject, listSwProjects } from '@/lib/screenwriting/server/projects'

const postSchema = z.object({
  title: z.string().min(1).max(200),
  kind: z.enum(['FEATURE', 'TV_SERIES', 'STAGE', 'OTHER']).optional(),
})

export async function GET() {
  try {
    const actor = getActor()
    const rows = await listSwProjects(actor.id)
    return NextResponse.json({ data: rows })
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function POST(request: Request) {
  try {
    const actor = getActor()
    const body = postSchema.parse(await request.json())
    const data = await createSwProject(actor.id, body.title, body.kind)
    return NextResponse.json({ data })
  } catch (err) {
    return jsonError(err, 400)
  }
}
