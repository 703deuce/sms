import { NextResponse } from 'next/server'
import { streamerPublicFlags } from '@/lib/server/streamer/env'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ data: streamerPublicFlags() })
}
