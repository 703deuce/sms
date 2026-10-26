import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { requireSwActor } from '@/lib/screenwriting/server/actor'
import { swSceneV1Schema } from '@/lib/screenwriting/integrations/studio-payload'

const bodySchema = swSceneV1Schema

export async function POST(request: Request) {
  try {
    await requireSwActor()
    const body = bodySchema.parse(await request.json())
    if (!process.env.SW_STUDIO_INTEGRATION_ENABLED) {
      return NextResponse.json({ data: { accepted: false, reason: 'feature_flag_off', scenes: body.scenes.length } })
    }
    return NextResponse.json({ data: { accepted: true, scenes: body.scenes.length } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
