import { NextResponse } from 'next/server'
import {
  isRecordingFeatureEnabled,
  isSoloEditorRecordingEnabled,
} from '@/lib/server/clips/feature-gates'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({
    enabled: isRecordingFeatureEnabled(),
    soloEnabled: isSoloEditorRecordingEnabled(),
  })
}
