import { NextResponse } from 'next/server'
import { pexelsConfigured } from '@/lib/server/ai/pexels'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'

export async function GET() {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  return NextResponse.json({ data: { pexels: pexelsConfigured() } })
}
