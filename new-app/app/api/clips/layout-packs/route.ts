import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createId } from '@/lib/supabase/id'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import { layoutPackCreateSchema } from '@/lib/clips/layout-packs'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId()
    const items = await getPrisma().layoutPack.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({ data: { items } })
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = layoutPackCreateSchema.parse(await request.json())
    const row = await getPrisma().layoutPack.create({
      data: {
        id: createId('lpack'),
        workspaceId,
        name: body.name,
        aspect: body.payload.aspect,
        payload: toPrismaJson(body.payload),
      },
    })
    return NextResponse.json({ data: { pack: row } }, { status: 201 })
  } catch (err) {
    return jsonError(err, 400)
  }
}
