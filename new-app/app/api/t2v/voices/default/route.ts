import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createId } from '@/lib/supabase/id'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'

const bodySchema = z.object({
  voiceId: z.string().min(1),
  name: z.string().min(1).max(120),
})

export async function POST(request: Request) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    const prisma = getPrisma()
    const saved = await prisma.t2vSavedVoice.findMany({ where: { workspaceId } })
    for (const row of saved) {
      const labels = (row.labels ?? {}) as Record<string, unknown>
      if (labels.role === 'default') {
        await prisma.t2vSavedVoice.update({
          where: { id: row.id },
          data: { labels: { ...labels, role: undefined } },
        })
      }
    }
    await prisma.t2vSavedVoice.upsert({
      where: { workspaceId_provider_voiceId: { workspaceId, provider: 'elevenlabs', voiceId: body.voiceId } },
      create: {
        id: createId('t2v'),
        workspaceId,
        provider: 'elevenlabs',
        voiceId: body.voiceId,
        name: body.name,
        labels: { role: 'default' },
        isClone: false,
      },
      update: { name: body.name, labels: { role: 'default' } },
    })
    return NextResponse.json({ data: { voiceId: body.voiceId } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
