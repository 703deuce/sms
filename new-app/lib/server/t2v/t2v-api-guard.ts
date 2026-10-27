import { NextResponse } from 'next/server'
import { isT2vFeatureEnabled } from '@/lib/server/clips/feature-gates'

export function t2vFeatureDisabledResponse(): NextResponse | null {
  if (!isT2vFeatureEnabled()) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return null
}
