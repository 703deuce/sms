import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { getLiveKitApi } from '@/lib/server/livekit/client'
import { roomNameForSession } from '@/lib/server/livekit/rooms'

const AGENT_NAME = process.env.CLIPS_TRANSCRIPTION_AGENT_NAME?.trim() || 'transovo-clips-transcription'

export function isRoomsTranscriptionConfigured(): boolean {
  return (
    process.env.CLIPS_ROOMS_TRANSCRIPTION_ENABLED === '1' &&
    Boolean(process.env.DEEPGRAM_API_KEY?.trim())
  )
}

export async function dispatchRoomsTranscriptionAgent(sessionId: string) {
  if (!isRoomsTranscriptionConfigured()) return { dispatched: false }
  const prisma = getPrisma()
  const session = await prisma.recordingSession.findFirst({
    where: { id: sessionId, kind: 'ROOM' },
    select: { transcriptionEnabled: true },
  })
  if (!session?.transcriptionEnabled) return { dispatched: false }

  const lk = getLiveKitApi()
  await lk.agentDispatch.createDispatch(roomNameForSession(sessionId), AGENT_NAME, {
    metadata: JSON.stringify({ sessionId, purpose: 'rooms_captions' }),
  })
  return { dispatched: true }
}
