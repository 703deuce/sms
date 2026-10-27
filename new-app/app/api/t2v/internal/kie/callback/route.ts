import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { getPrisma } from '@/lib/server/db'
import { fetchKieTask, parseResultVideoUrl } from '@/lib/server/ai/kie'
import { parseResultImageUrl } from '@/lib/server/ai/kie-image'

function verifyJobSig(jobId: string, sig: string): boolean {
  const secret = (
    process.env.KIE_T2V_CALLBACK_SECRET ||
    process.env.KIE_CALLBACK_SECRET ||
    process.env.WORKER_SHARED_SECRET ||
    ''
  ).trim()
  if (!secret || !jobId || !sig) return false
  const expected = createHmac('sha256', secret).update(jobId).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  const jobId = url.searchParams.get('jobId') || ''
  const sig = url.searchParams.get('s') || ''
  if (!verifyJobSig(jobId, sig)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await request.json().catch(() => ({}))

  const prisma = getPrisma()
  const job = await prisma.clipJob.findUnique({ where: { id: jobId }, select: { id: true, payload: true, type: true } })
  if (!job) return NextResponse.json({ ok: true })

  const payload = (job.payload ?? {}) as Record<string, unknown>
  const taskId = String(payload.kieTaskId || '')
  if (!taskId) return NextResponse.json({ ok: true })

  try {
    const record = await fetchKieTask(taskId)
    const state = String(record.state || '').toLowerCase()
    if (state !== 'success' && state !== 'succeeded' && state !== 'done') {
      return NextResponse.json({ ok: true })
    }
    const isImage = job.type === 'T2V_SCENE_AI_IMAGE'
    const assetUrl = isImage ? parseResultImageUrl(record.resultJson) : parseResultVideoUrl(record.resultJson)
    await prisma.clipJob.update({
      where: { id: jobId },
      data: {
        payload: {
          ...payload,
          kieResultUrl: assetUrl,
        },
      },
    })
  } catch {
    /* poll will retry */
  }

  return NextResponse.json({ ok: true })
}
