import { createHmac, timingSafeEqual } from 'crypto'

export function buildWanVideoTaskBody(input: {
  prompt: string
  durationS: number
  resolution: '480p' | '720p'
  callBackUrl: string
}) {
  const res = input.resolution === '720p' ? '720P' : '480P'
  return {
    model: 'wan/3-0-video',
    callBackUrl: input.callBackUrl,
    input: {
      prompt: input.prompt,
      aspect_ratio: '9:16',
      duration: Math.round(input.durationS),
      resolution: res,
    },
  }
}

export function signGenerationCallback(generationId: string, secret: string): string {
  return createHmac('sha256', secret).update(generationId).digest('hex')
}

export function verifyGenerationCallback(generationId: string, sig: string, secret: string): boolean {
  const expected = signGenerationCallback(generationId, secret)
  try {
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(sig, 'hex')
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}
