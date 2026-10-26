import 'server-only'

import { KIE_JOBS_API_BASE, getKieApiKey } from '@/lib/server/ai/kie'

export const KIE_UPLOAD_API_BASE =
  process.env.KIE_UPLOAD_BASE_URL?.trim().replace(/\/$/, '') || 'https://kieai.redpandaai.co'

export function resolveKieImageModel(): string {
  return process.env.KIE_IMAGE_MODEL?.trim() || 'nano-banana-2'
}

export function buildNanoBananaTaskBody(input: {
  prompt: string
  imageUrls: string[]
  aspectRatio: '9:16' | '16:9'
  callBackUrl: string
}) {
  return {
    model: resolveKieImageModel(),
    callBackUrl: input.callBackUrl,
    input: {
      prompt: input.prompt,
      image_input: input.imageUrls,
      image_urls: input.imageUrls,
      aspect_ratio: input.aspectRatio,
      resolution: '2K',
      output_format: 'png',
    },
  }
}

export async function uploadImageBytesToKie(input: {
  bytes: Buffer
  mime: string
  workspaceId: string
  label: string
}): Promise<string> {
  const ext = input.mime.includes('png') ? 'png' : 'jpg'
  const base64Data = `data:${input.mime};base64,${input.bytes.toString('base64')}`
  const pathSegment = `clips-${input.workspaceId}`.replace(/[^a-zA-Z0-9_-]/g, '_')
  const res = await fetch(`${KIE_UPLOAD_API_BASE}/api/file-base64-upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getKieApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      base64Data,
      uploadPath: pathSegment,
      fileName: `${input.label}-${Date.now()}.${ext}`,
    }),
  })
  const json = (await res.json()) as { code?: number; msg?: string; data?: { downloadUrl?: string; fileUrl?: string } }
  if (json.code !== 200) throw new Error(json.msg || 'KIE upload failed')
  const url = json.data?.downloadUrl || json.data?.fileUrl
  if (!url) throw new Error('KIE upload did not return URL')
  return url
}

export async function createKieImageTask(body: ReturnType<typeof buildNanoBananaTaskBody>): Promise<string> {
  const res = await fetch(`${KIE_JOBS_API_BASE}/api/v1/jobs/createTask`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getKieApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as { code?: number; msg?: string; data?: { taskId?: string } }
  if (json.code !== 200) throw new Error(json.msg || 'KIE createTask failed')
  const taskId = json.data?.taskId
  if (!taskId) throw new Error('KIE createTask missing taskId')
  return taskId
}

export function parseResultImageUrl(resultJson: string | undefined): string {
  if (!resultJson) throw new Error('missing resultJson')
  const parsed = JSON.parse(resultJson) as { resultUrls?: string[] }
  const url = parsed.resultUrls?.[0]
  if (!url) throw new Error('missing resultUrls')
  return url
}

export const KIE_IMAGE_COST_USD_2K = 0.06
