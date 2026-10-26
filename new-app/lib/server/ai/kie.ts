import 'server-only'

import {
  buildWanVideoTaskBody,
  signGenerationCallback as signGen,
  verifyGenerationCallback as verifyGen,
} from '@/lib/clips/kie-task'

export const KIE_JOBS_API_BASE =
  process.env.KIE_API_BASE_URL?.trim().replace(/\/$/, '') || 'https://api.kie.ai'

type KieEnvelope<T> = { code: number; msg: string; data?: T }

export function getKieApiKey(): string {
  const key = process.env.KIE_API_KEY?.trim()
  if (!key) throw new Error('KIE_API_KEY is not configured')
  return key
}

export function kieCallbackSecret(): string {
  const s = process.env.KIE_CALLBACK_SECRET?.trim()
  if (!s) throw new Error('KIE_CALLBACK_SECRET is not configured')
  return s
}

export function signGenerationCallback(generationId: string): string {
  return signGen(generationId, kieCallbackSecret())
}

export function verifyGenerationCallback(generationId: string, sig: string): boolean {
  return verifyGen(generationId, sig, kieCallbackSecret())
}

export { buildWanVideoTaskBody }

async function kieJsonPost<T>(url: string, body: unknown): Promise<KieEnvelope<T>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getKieApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as KieEnvelope<T>
  if (json.code !== 200) throw new Error(json.msg || `KIE request failed (${json.code})`)
  return json
}

async function kieJsonGet<T>(url: string): Promise<KieEnvelope<T>> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${getKieApiKey()}` } })
  const json = (await res.json()) as KieEnvelope<T>
  if (json.code !== 200) throw new Error(json.msg || `KIE request failed (${json.code})`)
  return json
}

export async function createVideoTask(input: {
  prompt: string
  durationS: number
  resolution: '480p' | '720p'
  callBackUrl: string
}): Promise<string> {
  const body = buildWanVideoTaskBody(input)
  const json = await kieJsonPost<{ taskId: string }>(`${KIE_JOBS_API_BASE}/api/v1/jobs/createTask`, body)
  const taskId = json.data?.taskId
  if (!taskId) throw new Error('KIE createTask did not return taskId')
  return taskId
}

export type KieTaskRecord = {
  taskId: string
  state: string
  failCode?: string
  failMsg?: string
  resultJson?: string
}

export async function fetchKieTask(taskId: string): Promise<KieTaskRecord> {
  const json = await kieJsonGet<KieTaskRecord>(
    `${KIE_JOBS_API_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
  )
  const record = json.data
  if (!record) throw new Error('KIE recordInfo returned no data')
  return record
}

export function parseResultVideoUrl(resultJson: string | undefined): string {
  if (!resultJson) throw new Error('KIE success response missing resultJson')
  const parsed = JSON.parse(resultJson) as { resultUrls?: string[] }
  const url = parsed.resultUrls?.[0]
  if (!url) throw new Error('KIE resultJson did not include resultUrls')
  return url
}

export { kieVideoCostUsd } from '@/lib/clips/kie-cost'
