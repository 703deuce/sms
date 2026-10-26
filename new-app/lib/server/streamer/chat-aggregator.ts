/**
 * In-memory live chat buffer (S13/S14). Flushed to DB on interval or size.
 */
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { streamerLiveRealtimeEnabled } from '@/lib/server/streamer/env'

const HYPE = /\b(pog|poggers|lmao|lol|wtf|insane|clutch|let's go|gg)\b/i
const MAX_PER_SEC = 4
const FLUSH_MS = 5000
const MAX_BUFFER = 500

type BufMsg = { at: Date; user: string; color?: string; text: string }

const buffers = new Map<string, { msgs: BufMsg[]; chatters: Set<string>; lastFlush: number }>()

function bucketStart(d: Date): Date {
  const ms = Math.floor(d.getTime() / 5000) * 5000
  return new Date(ms)
}

export function ingestLiveChatMessage(channelId: string, msg: { at: Date; user: string; color?: string; text: string }) {
  if (!streamerLiveRealtimeEnabled()) return
  const buf = buffers.get(channelId) ?? { msgs: [], chatters: new Set<string>(), lastFlush: Date.now() }
  buf.msgs.push(msg)
  buf.chatters.add(msg.user)
  buffers.set(channelId, buf)
  if (buf.msgs.length >= MAX_BUFFER) {
    void flushChannel(channelId)
  }
}

export async function flushChannel(channelId: string) {
  const buf = buffers.get(channelId)
  if (!buf || !buf.msgs.length) return
  buffers.set(channelId, { msgs: [], chatters: new Set(), lastFlush: Date.now() })
  const prisma = getPrisma()
  const byBucket = new Map<string, { count: number; chatters: Set<string>; hype: number; lines: BufMsg[] }>()
  for (const m of buf.msgs) {
    const b = bucketStart(m.at).toISOString()
    const row = byBucket.get(b) ?? { count: 0, chatters: new Set(), hype: 0, lines: [] }
    row.count += 1
    row.chatters.add(m.user)
    if (HYPE.test(m.text)) row.hype += 1
    const sec = Math.floor(m.at.getTime() / 1000)
    const secKey = `${b}:${sec}`
    const secCount = row.lines.filter((l) => Math.floor(l.at.getTime() / 1000) === sec).length
    if (secCount < MAX_PER_SEC) row.lines.push(m)
    byBucket.set(b, row)
  }
  for (const [iso, agg] of byBucket) {
    await prisma.streamChatBucket.upsert({
      where: { channelId_bucketStart: { channelId, bucketStart: new Date(iso) } },
      create: {
        channelId,
        bucketStart: new Date(iso),
        count: agg.count,
        chatters: agg.chatters.size,
        hype: agg.hype,
      },
      update: {
        count: { increment: agg.count },
        chatters: agg.chatters.size,
        hype: { increment: agg.hype },
      },
    })
    if (agg.lines.length) {
      await prisma.streamChatLine.createMany({
        data: agg.lines.map((l) => ({
          id: createId('scl'),
          channelId,
          at: l.at,
          user: l.user.slice(0, 32),
          color: l.color?.slice(0, 16) ?? null,
          text: l.text.slice(0, 200),
        })),
      })
    }
  }
}

export function startChatAggregatorFlushLoop() {
  if (typeof setInterval === 'undefined') return
  setInterval(() => {
    for (const channelId of buffers.keys()) {
      void flushChannel(channelId)
    }
  }, FLUSH_MS)
}
