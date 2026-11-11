import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import {
  publishTemplateProject,
  TemplateAssetUnavailable,
  TemplateInstanceConflict,
  TemplateInstanceNotFound,
  type TemplateAuthoringState,
} from '@/lib/server/clips/real-video-template-instances'

const bodySchema = z.object({
  idempotencyKey: z.string().min(8).max(120),
  title: z.string().max(200).optional(),
  family: z.unknown(),
  design: z.unknown(),
  choices: z.unknown(),
}).strict()

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    const result = await publishTemplateProject(
      workspaceId,
      body.idempotencyKey,
      body.family,
      body.design,
      body.choices as TemplateAuthoringState,
      body.title,
    )
    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    if (error instanceof TemplateAssetUnavailable || error instanceof TemplateInstanceNotFound)
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (error instanceof TemplateInstanceConflict)
      return NextResponse.json({ error: 'Template instance conflict' }, { status: 409 })
    return jsonError(error, 400)
  }
}
