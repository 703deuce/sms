import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { enqueueT2vAssemble } from '@/lib/server/t2v/drafts'
// Progress: client polls GET /api/t2v/drafts/[id] (status/stage/progress), same 2 s cadence as the clips project page.
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return NextResponse.json({ data: await enqueueT2vAssemble(await resolveWorkspaceId(), id) })
}
